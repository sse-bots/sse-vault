import { NextResponse } from "next/server";
import { z } from "zod";
import { getVaultSession } from "@/lib/session";
import { getVaultCollections } from "@/lib/mongodb";
import {
  LOCKOUT_MS,
  MAX_FAILED_ATTEMPTS,
  applyPinUnlockCookie,
  clearPinUnlockCookie,
  getVaultPinStatus,
  hashVaultPin,
  nativePinTokenFor,
  sanitizeAutoLockMinutes,
  verifyVaultPinHash,
} from "@/lib/vault-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };

const sixDigitSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "PIN must be exactly 6 digits.");

const pinActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setup"),
    pin: sixDigitSchema,
    confirmPin: sixDigitSchema,
  }),
  z.object({
    action: z.literal("verify"),
    pin: sixDigitSchema,
  }),
  z.object({
    action: z.literal("change"),
    currentPin: sixDigitSchema,
    newPin: sixDigitSchema,
    confirmPin: sixDigitSchema,
  }),
  z.object({
    action: z.literal("lock"),
  }),
  z.object({
    action: z.literal("preferences"),
    autoLockMinutes: z.number().int(),
  }),
]);

export async function GET() {
  const ctx = await getVaultSession();
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_CACHE }
    );
  }
  const pinStatus = await getVaultPinStatus(ctx.userId);
  return NextResponse.json({ pinStatus }, { headers: NO_CACHE });
}

export async function POST(req: Request) {
  const ctx = await getVaultSession();
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_CACHE }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = pinActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid PIN request." },
      { status: 400, headers: NO_CACHE }
    );
  }

  const { vaultPinConfigs } = await getVaultCollections();
  const data = parsed.data;

  // 1. LOCK VAULT IMMEDIATELY
  if (data.action === "lock") {
    const res = NextResponse.json(
      { ok: true, unlocked: false },
      { headers: NO_CACHE }
    );
    clearPinUnlockCookie(res);
    return res;
  }

  const existing = await vaultPinConfigs.findOne({ ownerUserId: ctx.userId });

  // 2. INITIAL 6-DIGIT PIN SETUP
  if (data.action === "setup") {
    if (existing?.pinHash) {
      return NextResponse.json(
        { error: "A 6-digit Vault PIN is already configured." },
        { status: 409, headers: NO_CACHE }
      );
    }
    if (data.pin !== data.confirmPin) {
      return NextResponse.json(
        { error: "The two 6-digit PINs do not match." },
        { status: 400, headers: NO_CACHE }
      );
    }

    const { hash, salt } = hashVaultPin(data.pin);
    const now = new Date();
    const autoLockMinutes = 30;

    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      {
        $set: {
          ownerUserId: ctx.userId,
          pinHash: hash,
          pinSalt: salt,
          pinVersion: 1,
          autoLockMinutes,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    let res = NextResponse.json(
      {
        ok: true,
        pinStatus: {
          hasPin: true,
          unlocked: true,
          autoLockMinutes,
          failedAttempts: 0,
          lockedUntil: null,
        },
      },
      { headers: NO_CACHE }
    );
    const nativeToken = await nativePinTokenFor({
      userId: ctx.userId,
      pinVersion: 1,
      autoLockMinutes: autoLockMinutes,
    });
    const resJson = await res.clone().json();
    const out = NextResponse.json(
      nativeToken ? { ...resJson, pinToken: nativeToken } : resJson,
      { headers: NO_CACHE }
    );
    res.cookies.getAll().forEach((c) => out.cookies.set(c));
    res = out;
    applyPinUnlockCookie(res, {
      userId: ctx.userId,
      pinVersion: 1,
      autoLockMinutes,
    });
    return res;
  }

  if (!existing?.pinHash || !existing?.pinSalt) {
    return NextResponse.json(
      { error: "You must create a 6-digit Vault PIN first." },
      { status: 400, headers: NO_CACHE }
    );
  }

  const pinVersion = Number(existing.pinVersion || 1);
  const autoLockMinutes = sanitizeAutoLockMinutes(
    existing.autoLockMinutes ?? 30
  );

  // 3. VERIFY 6-DIGIT PIN TO UNLOCK VAULT
  if (data.action === "verify") {
    const lockedUntil = existing.lockedUntil
      ? new Date(existing.lockedUntil as string | Date)
      : null;

    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      const waitSec = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Too many wrong PIN attempts. Try again in ${waitSec}s.`,
          lockedUntil: lockedUntil.toISOString(),
        },
        { status: 429, headers: NO_CACHE }
      );
    }

    const valid = verifyVaultPinHash(
      data.pin,
      String(existing.pinHash),
      String(existing.pinSalt)
    );

    if (!valid) {
      const nextFails = Number(existing.failedAttempts || 0) + 1;
      const shouldLockout = nextFails >= MAX_FAILED_ATTEMPTS;
      const nextLockUntil = shouldLockout
        ? new Date(Date.now() + LOCKOUT_MS)
        : null;

      await vaultPinConfigs.updateOne(
        { ownerUserId: ctx.userId },
        {
          $set: {
            failedAttempts: shouldLockout ? 0 : nextFails,
            lockedUntil: nextLockUntil,
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json(
        {
          error: shouldLockout
            ? "Too many incorrect attempts. Vault PIN entry paused for 2 minutes."
            : `Incorrect 6-digit PIN (${MAX_FAILED_ATTEMPTS - nextFails} attempt${
                MAX_FAILED_ATTEMPTS - nextFails === 1 ? "" : "s"
              } left).`,
          lockedUntil: nextLockUntil ? nextLockUntil.toISOString() : null,
        },
        { status: 401, headers: NO_CACHE }
      );
    }

    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      {
        $set: {
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
      }
    );

    let res = NextResponse.json(
      {
        ok: true,
        pinStatus: {
          hasPin: true,
          unlocked: true,
          autoLockMinutes,
          failedAttempts: 0,
          lockedUntil: null,
        },
      },
      { headers: NO_CACHE }
    );
    const nativeToken = await nativePinTokenFor({
      userId: ctx.userId,
      pinVersion: pinVersion,
      autoLockMinutes: autoLockMinutes,
    });
    const resJson = await res.clone().json();
    const out = NextResponse.json(
      nativeToken ? { ...resJson, pinToken: nativeToken } : resJson,
      { headers: NO_CACHE }
    );
    res.cookies.getAll().forEach((c) => out.cookies.set(c));
    res = out;
    applyPinUnlockCookie(res, {
      userId: ctx.userId,
      pinVersion,
      autoLockMinutes,
    });
    return res;
  }

  // 4. CHANGE EXISTING 6-DIGIT PIN (Requires current PIN & invalidates other sessions)
  if (data.action === "change") {
    const valid = verifyVaultPinHash(
      data.currentPin,
      String(existing.pinHash),
      String(existing.pinSalt)
    );
    if (!valid) {
      return NextResponse.json(
        { error: "Current 6-digit PIN is incorrect." },
        { status: 401, headers: NO_CACHE }
      );
    }
    if (data.newPin !== data.confirmPin) {
      return NextResponse.json(
        { error: "New PIN and confirmation do not match." },
        { status: 400, headers: NO_CACHE }
      );
    }
    if (data.newPin === data.currentPin) {
      return NextResponse.json(
        { error: "New PIN must be different from your current PIN." },
        { status: 400, headers: NO_CACHE }
      );
    }

    const { hash, salt } = hashVaultPin(data.newPin);
    const nextVersion = pinVersion + 1;

    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      {
        $set: {
          pinHash: hash,
          pinSalt: salt,
          pinVersion: nextVersion,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
      }
    );

    let res = NextResponse.json(
      {
        ok: true,
        pinStatus: {
          hasPin: true,
          unlocked: true,
          autoLockMinutes,
          failedAttempts: 0,
          lockedUntil: null,
        },
      },
      { headers: NO_CACHE }
    );
    const nativeToken = await nativePinTokenFor({
      userId: ctx.userId,
      pinVersion: nextVersion,
      autoLockMinutes: autoLockMinutes,
    });
    const resJson = await res.clone().json();
    const out = NextResponse.json(
      nativeToken ? { ...resJson, pinToken: nativeToken } : resJson,
      { headers: NO_CACHE }
    );
    res.cookies.getAll().forEach((c) => out.cookies.set(c));
    res = out;
    applyPinUnlockCookie(res, {
      userId: ctx.userId,
      pinVersion: nextVersion,
      autoLockMinutes,
    });
    return res;
  }

  // 5. UPDATE AUTO-LOCK TIMEOUT PREFERENCE
  if (data.action === "preferences") {
    const currentStatus = await getVaultPinStatus(ctx.userId);
    if (!currentStatus.unlocked) {
      return NextResponse.json(
        { error: "Unlock your vault first." },
        { status: 423, headers: NO_CACHE }
      );
    }

    const nextAutoLock = sanitizeAutoLockMinutes(data.autoLockMinutes);
    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      { $set: { autoLockMinutes: nextAutoLock, updatedAt: new Date() } }
    );

    let res = NextResponse.json(
      {
        ok: true,
        pinStatus: {
          ...currentStatus,
          autoLockMinutes: nextAutoLock,
        },
      },
      { headers: NO_CACHE }
    );
    const nativeToken = await nativePinTokenFor({
      userId: ctx.userId,
      pinVersion: pinVersion,
      autoLockMinutes: nextAutoLock,
    });
    const resJson = await res.clone().json();
    const out = NextResponse.json(
      nativeToken ? { ...resJson, pinToken: nativeToken } : resJson,
      { headers: NO_CACHE }
    );
    res.cookies.getAll().forEach((c) => out.cookies.set(c));
    res = out;
    applyPinUnlockCookie(res, {
      userId: ctx.userId,
      pinVersion,
      autoLockMinutes: nextAutoLock,
    });
    return res;
  }

  return NextResponse.json(
    { error: "Unsupported action." },
    { status: 400, headers: NO_CACHE }
  );
}
