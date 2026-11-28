import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getVaultSession } from "@/lib/session";
import { getVaultCollections } from "@/lib/mongodb";
import {
  LOCKOUT_MS,
  MAX_FAILED_ATTEMPTS,
  RESET_WINDOW_MS,
  applyPinUnlockCookie,
  clearPinUnlockCookie,
  getVaultPinStatus,
  hashSecurityAnswer,
  hashVaultPin,
  nativePinTokenFor,
  sanitizeAutoLockMinutes,
  verifySecurityAnswer,
  verifyVaultPinHash,
  type StoredSecurityQuestion,
} from "@/lib/vault-pin";
import { logVaultActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };

const sixDigitSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "PIN must be exactly 6 digits.");

const securityQuestionInputSchema = z.object({
  question: z.string().trim().min(5, "Security question is too short.").max(180),
  answer: z.string().trim().min(2, "Answer must be at least 2 characters.").max(120),
});

const pinActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setup"),
    pin: sixDigitSchema,
    confirmPin: sixDigitSchema,
    securityQuestions: z.array(securityQuestionInputSchema).min(2).max(3).optional(),
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
    action: z.literal("set_security_questions"),
    questions: z.array(securityQuestionInputSchema).min(2, "Set at least 2 security questions.").max(3),
  }),
  z.object({
    action: z.literal("reset_via_questions"),
    answers: z.array(z.string().trim().min(1, "Please answer all security questions.").max(120)).min(2).max(3),
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
  return NextResponse.json(
    { pinStatus, canResetPin: Boolean(pinStatus.canResetPin) },
    { headers: NO_CACHE }
  );
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

  // 1. FIRST-TIME PIN SETUP (defaults to 1 min auto-lock!)
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
    const autoLockMinutes = 1;
    const pinVersion = 1;

    const storedQuestions: StoredSecurityQuestion[] = (
      data.securityQuestions || []
    ).map((q) => {
      const { answerHash, answerSalt } = hashSecurityAnswer(q.answer);
      return { question: q.question.trim(), answerHash, answerSalt };
    });

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
          ...(storedQuestions.length >= 2
            ? { securityQuestions: storedQuestions }
            : {}),
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
        hasSecurityQuestions: storedQuestions.length >= 2,
        securityQuestions: storedQuestions.map((q) => q.question),
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

  // 2. SAVE / UPDATE SECURITY QUESTIONS (requires unlocked vault)
  if (data.action === "set_security_questions") {
    const status = await getVaultPinStatus(ctx.userId);
    if (!status.unlocked) {
      return NextResponse.json(
        { error: "Unlock your vault first to update security questions." },
        { status: 423, headers: NO_CACHE }
      );
    }

    const storedQuestions: StoredSecurityQuestion[] = data.questions.map((q) => {
      const { answerHash, answerSalt } = hashSecurityAnswer(q.answer);
      return { question: q.question.trim(), answerHash, answerSalt };
    });

    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      { $set: { securityQuestions: storedQuestions, updatedAt: new Date() } }
    );

    await logVaultActivity(
      ctx.userId,
      "security_questions",
      `Updated ${storedQuestions.length} case-insensitive PIN recovery security questions`
    );

    const updatedStatus = await getVaultPinStatus(ctx.userId);
    return NextResponse.json(
      { ok: true, pinStatus: updatedStatus },
      { headers: NO_CACHE }
    );
  }

  // 3. FORGOT PIN RESET VIA SECURITY QUESTIONS (CASE-INSENSITIVE!)
  if (data.action === "reset_via_questions") {
    if (!existing?.pinHash) {
      return NextResponse.json(
        { error: "No Vault PIN is configured yet." },
        { status: 400, headers: NO_CACHE }
      );
    }

    const lockedUntil = existing.lockedUntil
      ? new Date(existing.lockedUntil as string | Date)
      : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      const secs = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Too many wrong attempts. Try again in ${secs}s.`,
          lockedUntil: lockedUntil.toISOString(),
        },
        { status: 429, headers: NO_CACHE }
      );
    }

    const savedQs: StoredSecurityQuestion[] = Array.isArray(
      existing.securityQuestions
    )
      ? (existing.securityQuestions as StoredSecurityQuestion[])
      : [];
    if (savedQs.length < 2) {
      return NextResponse.json(
        {
          error:
            "Security questions are not set up on this account yet. Use SSE Accounts verification to reset your PIN.",
        },
        { status: 400, headers: NO_CACHE }
      );
    }

    if (data.newPin !== data.confirmPin) {
      return NextResponse.json(
        { error: "New PINs do not match." },
        { status: 400, headers: NO_CACHE }
      );
    }

    if (data.answers.length < savedQs.length) {
      return NextResponse.json(
        { error: "Please answer all security questions." },
        { status: 400, headers: NO_CACHE }
      );
    }

    const allCorrect = savedQs.every((sq, idx) =>
      verifySecurityAnswer(data.answers[idx] || "", sq.answerHash, sq.answerSalt)
    );

    if (!allCorrect) {
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
        "Failed security question verification during PIN reset"
      );

      return NextResponse.json(
        {
          error: shouldLock
            ? "Too many wrong answers. Recovery locked for 2 minutes."
            : `One or more answers did not match (answers are not case-sensitive). ${MAX_FAILED_ATTEMPTS - nextFails} attempt(s) left.`,
          lockedUntil: nextLockedUntil ? nextLockedUntil.toISOString() : null,
        },
        { status: shouldLock ? 429 : 401, headers: NO_CACHE }
      );
    }

    const { hash, salt } = hashVaultPin(data.newPin);
    const nextVersion = Number(existing.pinVersion || 0) + 1;
    const autoLockMinutes = sanitizeAutoLockMinutes(existing.autoLockMinutes ?? 1);

    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      {
        $set: {
          pinHash: hash,
          pinSalt: salt,
          pinVersion: nextVersion,
          autoLockMinutes,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
      }
    );

    await logVaultActivity(
      ctx.userId,
      "pin_reset",
      "Reset 6-digit Vault PIN using Security Questions"
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
        hasSecurityQuestions: true,
        securityQuestions: savedQs.map((q) => q.question),
        canResetPin: false,
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

  // 4. FORGOT PIN RESET VIA FRESH SSE ACCOUNTS RE-AUTH
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
      existing?.autoLockMinutes ?? 1
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
      "Reset 6-digit Vault PIN via SSE Accounts verification"
    );

    const savedQs: StoredSecurityQuestion[] = Array.isArray(
      existing?.securityQuestions
    )
      ? (existing.securityQuestions as StoredSecurityQuestion[])
      : [];

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
        hasSecurityQuestions: savedQs.length >= 2,
        securityQuestions: savedQs.map((q) => q.question),
        canResetPin: false,
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

  const savedQs: StoredSecurityQuestion[] = Array.isArray(
    existing.securityQuestions
  )
    ? (existing.securityQuestions as StoredSecurityQuestion[])
    : [];

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

  // 5. VERIFY 6-DIGIT PIN
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
      existing.autoLockMinutes ?? 1
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
        hasSecurityQuestions: savedQs.length >= 2,
        securityQuestions: savedQs.map((q) => q.question),
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

  // 6. CHANGE 6-DIGIT PIN
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
      existing.autoLockMinutes ?? 1
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
        hasSecurityQuestions: savedQs.length >= 2,
        securityQuestions: savedQs.map((q) => q.question),
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

  // 7. UPDATE AUTO-LOCK TIMER (1 min, 5 min, 15 min, 30 min, 1 hour, 0)
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
        hasSecurityQuestions: savedQs.length >= 2,
        securityQuestions: savedQs.map((q) => q.question),
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
