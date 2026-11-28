import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
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
import { logVaultActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };
const RESET_WINDOW_MS = 10 * 60 * 1000;

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
    action: z.literal("reset"),
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
  const rawSess = await getSession();
  const canResetPin = Boolean(
    rawSess?.pinResetFreshAt &&
      Date.now() - rawSess.pinResetFreshAt <= RESET_WINDOW_MS
  );
  return NextResponse.json({ pinStatus, canResetPin }, { headers: NO_CACHE });
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

  if (data.action === "lock") {
    const res = NextResponse.json(
      { ok: true, unlocked: false },
      { headers: NO_CACHE }
    );
    clearPinUnlockCookie(res);
    return res;
  }

  const existing = await vaultPinConfigs.findOne({ ownerUserId: ctx.userId });

  if (data.action === "setup") {
    if (existing?.pinHash) {
      return NextResponse.json(
        { error: "Vault PIN is already set. Use Change PIN or Forgot PIN." },
        { status: 409, headers: NO_CACHE }
      );
    }
    if (data.pin !== data.confirmPin) {
      return NextResponse.json(
        { error: "PINs do not match." },
        { status: 400, headers: NO_CACHE }
      );
    }

    const { hash, salt } = hashVaultPin(data.pin);
    const now = new Date();
    const autoLockMinutes = 30;
    const pinVersion = 1;

    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      {
        $set: {
          ownerUserId: ctx.userId,
          pinHash: hash,
          pinSalt: salt,
          pinVersion,
          autoLockMinutes,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    await logVaultActivity(ctx.userId, "pin_setup", "Set up 6-digit Vault PIN");

    const nativeToken = await nativePinTokenFor({
      userId: ctx.userId,
      pinVersion,
      autoLockMinutes,
    });
    const resJson = {
      ok: true,
      pinStatus: {
        hasPin: true,
        unlocked: true,
        autoLockMinutes,
        failedAttempts: 0,
        lockedUntil: null,
      },
    };
    const res = NextResponse.json(
      nativeToken ? { ...resJson, pinToken: nativeToken } : resJson,
      { headers: NO_CACHE }
    );
    applyPinUnlockCookie(res, {
      userId: ctx.userId,
      pinVersion,
      autoLockMinutes,
    });
    return res;
  }

  if (data.action === "reset") {
    const rawSess = await getSession();
    const fresh = Boolean(
      rawSess?.pinResetFreshAt &&
        Date.now() - rawSess.pinResetFreshAt <= RESET_WINDOW_MS
    );
    if (!fresh) {
      return NextResponse.json(
        {
          error:
            "Fresh SSE Accounts verification required to reset your Vault PIN.",
          requiresReauth: true,
        },
        { status: 403, headers: NO_CACHE }
      );
    }
    if (data.newPin !== data.confirmPin) {
      return NextResponse.json(
        { error: "New PINs do not match." },
        { status: 400, headers: NO_CACHE }
      );
    }

    const { hash, salt } = hashVaultPin(data.newPin);
    const nextVersion = Number(existing?.pinVersion || 0) + 1;
    const autoLockMinutes = sanitizeAutoLockMinutes(
      existing?.autoLockMinutes ?? 30
    );
    const now = new Date();

    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      {
        $set: {
          ownerUserId: ctx.userId,
          pinHash: hash,
          pinSalt: salt,
          pinVersion: nextVersion,
          autoLockMinutes,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    await logVaultActivity(
      ctx.userId,
      "pin_reset",
      "Reset 6-digit Vault PIN via SSE Accounts re-authentication"
    );

    const nativeToken = await nativePinTokenFor({
      userId: ctx.userId,
      pinVersion: nextVersion,
      autoLockMinutes,
    });
    const resJson = {
      ok: true,
      pinStatus: {
        hasPin: true,
        unlocked: true,
        autoLockMinutes,
        failedAttempts: 0,
        lockedUntil: null,
      },
    };
    const res = NextResponse.json(
      nativeToken ? { ...resJson, pinToken: nativeToken } : resJson,
      { headers: NO_CACHE }
    );
    applyPinUnlockCookie(res, {
      userId: ctx.userId,
      pinVersion: nextVersion,
      autoLockMinutes,
    });
    return res;
  }

  if (!existing?.pinHash || !existing?.pinSalt) {
    return NextResponse.json(
      { error: "Please set up your 6-digit Vault PIN first." },
      { status: 400, headers: NO_CACHE }
    );
  }

  const lockedUntil = existing.lockedUntil
    ? new Date(existing.lockedUntil as string | Date)
    : null;
  if (
    (data.action === "verify" || data.action === "change") &&
    lockedUntil &&
    lockedUntil.getTime() > Date.now()
  ) {
    const secs = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: `Too many wrong attempts. Try again in ${secs}s.`,
        lockedUntil: lockedUntil.toISOString(),
      },
      { status: 429, headers: NO_CACHE }
    );
  }

  if (data.action === "verify") {
    const ok = verifyVaultPinHash(
      data.pin,
      String(existing.pinHash),
      String(existing.pinSalt)
    );

    if (!ok) {
      const nextFails = Number(existing.failedAttempts || 0) + 1;
      const shouldLock = nextFails >= MAX_FAILED_ATTEMPTS;
      const nextLockedUntil = shouldLock
        ? new Date(Date.now() + LOCKOUT_MS)
        : null;

      await vaultPinConfigs.updateOne(
        { ownerUserId: ctx.userId },
        {
          $set: {
            failedAttempts: shouldLock ? 0 : nextFails,
            lockedUntil: nextLockedUntil,
            updatedAt: new Date(),
          },
        }
      );

      await logVaultActivity(
        ctx.userId,
        "pin_failed",
        shouldLock
          ? "Vault PIN lockout triggered after 5 failed attempts"
          : `Failed Vault PIN attempt (${nextFails}/${MAX_FAILED_ATTEMPTS})`
      );

      return NextResponse.json(
        {
          error: shouldLock
            ? "Too many incorrect PINs. Vault locked for 2 minutes."
            : `Incorrect PIN. ${MAX_FAILED_ATTEMPTS - nextFails} attempt(s) remaining.`,
          failedAttempts: shouldLock ? MAX_FAILED_ATTEMPTS : nextFails,
          lockedUntil: nextLockedUntil ? nextLockedUntil.toISOString() : null,
        },
        { status: shouldLock ? 429 : 401, headers: NO_CACHE }
      );
    }

    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      {
        $set: {
          failedAttempts: 0,
          lockedUntil: null,
          lastUnlockedAt: new Date(),
        },
      }
    );

    await logVaultActivity(ctx.userId, "pin_unlock", "Unlocked vault with PIN");

    const pinVersion = Number(existing.pinVersion || 1);
    const autoLockMinutes = sanitizeAutoLockMinutes(
      existing.autoLockMinutes ?? 30
    );

    const nativeToken = await nativePinTokenFor({
      userId: ctx.userId,
      pinVersion,
      autoLockMinutes,
    });
    const resJson = {
      ok: true,
      pinStatus: {
        hasPin: true,
        unlocked: true,
        autoLockMinutes,
        failedAttempts: 0,
        lockedUntil: null,
      },
    };
    const res = NextResponse.json(
      nativeToken ? { ...resJson, pinToken: nativeToken } : resJson,
      { headers: NO_CACHE }
    );
    applyPinUnlockCookie(res, {
      userId: ctx.userId,
      pinVersion,
      autoLockMinutes,
    });
    return res;
  }

  if (data.action === "change") {
    const ok = verifyVaultPinHash(
      data.currentPin,
      String(existing.pinHash),
      String(existing.pinSalt)
    );
    if (!ok) {
      return NextResponse.json(
        { error: "Current 6-digit PIN is incorrect." },
        { status: 401, headers: NO_CACHE }
      );
    }
    if (data.newPin !== data.confirmPin) {
      return NextResponse.json(
        { error: "New PINs do not match." },
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
    const nextVersion = Number(existing.pinVersion || 1) + 1;
    const autoLockMinutes = sanitizeAutoLockMinutes(
      existing.autoLockMinutes ?? 30
    );

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

    await logVaultActivity(ctx.userId, "pin_change", "Changed 6-digit Vault PIN");

    const nativeToken = await nativePinTokenFor({
      userId: ctx.userId,
      pinVersion: nextVersion,
      autoLockMinutes,
    });
    const resJson = {
      ok: true,
      pinStatus: {
        hasPin: true,
        unlocked: true,
        autoLockMinutes,
        failedAttempts: 0,
        lockedUntil: null,
      },
    };
    const res = NextResponse.json(
      nativeToken ? { ...resJson, pinToken: nativeToken } : resJson,
      { headers: NO_CACHE }
    );
    applyPinUnlockCookie(res, {
      userId: ctx.userId,
      pinVersion: nextVersion,
      autoLockMinutes,
    });
    return res;
  }

  if (data.action === "preferences") {
    const status = await getVaultPinStatus(ctx.userId);
    if (!status.unlocked) {
      return NextResponse.json(
        { error: "Unlock your vault first to change security preferences." },
        { status: 423, headers: NO_CACHE }
      );
    }
    const autoLockMinutes = sanitizeAutoLockMinutes(data.autoLockMinutes);
    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      { $set: { autoLockMinutes, updatedAt: new Date() } }
    );

    const pinVersion = Number(existing.pinVersion || 1);
    const nativeToken = await nativePinTokenFor({
      userId: ctx.userId,
      pinVersion,
      autoLockMinutes,
    });
    const resJson = {
      ok: true,
      pinStatus: {
        hasPin: true,
        unlocked: true,
        autoLockMinutes,
        failedAttempts: 0,
        lockedUntil: null,
      },
    };
    const res = NextResponse.json(
      nativeToken ? { ...resJson, pinToken: nativeToken } : resJson,
      { headers: NO_CACHE }
    );
    applyPinUnlockCookie(res, {
      userId: ctx.userId,
      pinVersion,
      autoLockMinutes,
    });
    return res;
  }

  return NextResponse.json(
    { error: "Unsupported PIN action." },
    { status: 400, headers: NO_CACHE }
  );
}
