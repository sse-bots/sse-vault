import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { getVaultCollections } from "./mongodb";
import { getVaultSession, type VaultUserSession } from "./session";

export const PIN_COOKIE_NAME = "sse_vault_pin_unlock";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes after 5 wrong PINs
const ALLOWED_AUTOLOCK = new Set([0, 5, 15, 30, 60]);

export interface VaultPinStatus {
  hasPin: boolean;
  unlocked: boolean;
  autoLockMinutes: number;
  failedAttempts: number;
  lockedUntil: string | null;
}

function getSigningSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.VAULT_ENCRYPTION_SECRET ||
    "dev-vault-pin-signing-fallback"
  ).trim();
}

function isProductionHttps(): boolean {
  const url = (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).trim();
  if (url.startsWith("https://")) return true;
  return process.env.NODE_ENV === "production";
}

export function isValidSixDigitPin(pin: string): boolean {
  return /^\d{6}$/.test((pin || "").trim());
}

export function hashVaultPin(pin: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyVaultPinHash(
  pin: string,
  expectedHash: string,
  salt: string
): boolean {
  try {
    const derived = crypto.scryptSync(pin, salt, 64);
    const expected = Buffer.from(expectedHash, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function signPinUnlockToken(params: {
  userId: string;
  pinVersion: number;
  autoLockMinutes: number;
}): { token: string; maxAgeSeconds?: number } {
  const ttlMinutes =
    params.autoLockMinutes > 0 ? params.autoLockMinutes : 60 * 12; // 12h cap for session cookies
  const exp = Date.now() + ttlMinutes * 60 * 1000;

  const payload = Buffer.from(
    JSON.stringify({
      uid: params.userId,
      ver: params.pinVersion,
      exp,
    }),
    "utf8"
  ).toString("base64url");

  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");

  return {
    token: `${payload}.${sig}`,
    maxAgeSeconds:
      params.autoLockMinutes > 0 ? params.autoLockMinutes * 60 : undefined,
  };
}

export function verifyPinUnlockToken(
  token: string | undefined | null,
  expectedUserId: string,
  expectedPinVersion: number
): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");

  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { uid?: string; ver?: number; exp?: number };

    if (decoded.uid !== expectedUserId) return false;
    if (decoded.ver !== expectedPinVersion) return false;
    if (!decoded.exp || Date.now() > decoded.exp) return false;

    return true;
  } catch {
    return false;
  }
}

export function applyPinUnlockCookie(
  res: NextResponse,
  params: { userId: string; pinVersion: number; autoLockMinutes: number }
) {
  const { token, maxAgeSeconds } = signPinUnlockToken(params);
  res.cookies.set(PIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionHttps(),
    path: "/",
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds } : {}),
  });
}

export function clearPinUnlockCookie(res: NextResponse) {
  res.cookies.set(PIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionHttps(),
    path: "/",
    maxAge: 0,
  });
}

export function sanitizeAutoLockMinutes(val: unknown): number {
  const num = Number(val);
  if (Number.isFinite(num) && ALLOWED_AUTOLOCK.has(num)) return num;
  return 30;
}

export async function getVaultPinStatus(
  userId: string
): Promise<VaultPinStatus> {
  const { vaultPinConfigs } = await getVaultCollections();
  const doc = await vaultPinConfigs.findOne({ ownerUserId: userId });

  if (!doc || !doc.pinHash || !doc.pinSalt) {
    return {
      hasPin: false,
      unlocked: false,
      autoLockMinutes: 30,
      failedAttempts: 0,
      lockedUntil: null,
    };
  }

  const pinVersion = Number(doc.pinVersion || 1);
  const autoLockMinutes = sanitizeAutoLockMinutes(doc.autoLockMinutes ?? 30);
  const failedAttempts = Number(doc.failedAttempts || 0);
  const lockedUntilDate = doc.lockedUntil
    ? new Date(doc.lockedUntil as string | Date)
    : null;
  const isCooldown = Boolean(
    lockedUntilDate && lockedUntilDate.getTime() > Date.now()
  );

  const cookieStore = await cookies();
  let token = cookieStore.get(PIN_COOKIE_NAME)?.value;
  if (!token) {
    try {
      token = (await headers()).get("x-vault-pin-token") || undefined;
    } catch {
      /* no request context */
    }
  }
  const unlocked = verifyPinUnlockToken(token, userId, pinVersion);

  return {
    hasPin: true,
    unlocked,
    autoLockMinutes,
    failedAttempts,
    lockedUntil: isCooldown && lockedUntilDate ? lockedUntilDate.toISOString() : null,
  };
}

export async function requireUnlockedVaultSession(): Promise<
  | { ok: true; session: VaultUserSession }
  | { ok: false; response: NextResponse }
> {
  const session = await getVaultSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  const pinStatus = await getVaultPinStatus(session.userId);
  if (!pinStatus.hasPin || !pinStatus.unlocked) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: pinStatus.hasPin
            ? "Vault is locked. Enter your 6-digit Vault PIN to access your data."
            : "Set up a 6-digit Vault PIN before accessing your vault.",
          pinRequired: true,
          hasPin: pinStatus.hasPin,
          unlocked: false,
        },
        { status: 423, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }

  return { ok: true, session };
}

export { MAX_FAILED_ATTEMPTS, LOCKOUT_MS };

/**
 * For the native app only (header `x-sse-client: native`): returns the signed
 * unlock token so the app can keep it in secure storage instead of a cookie.
 */
export async function nativePinTokenFor(params: {
  userId: string;
  pinVersion: number;
  autoLockMinutes: number;
}): Promise<string | undefined> {
  try {
    const h = await headers();
    if (h.get("x-sse-client") !== "native") return undefined;
  } catch {
    return undefined;
  }
  return signPinUnlockToken(params).token;
}
