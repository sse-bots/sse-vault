import crypto from "crypto";
import { cookies, headers } from "next/headers";

export const SESSION_COOKIE = "sse_vault_session";
export const OAUTH_STATE_COOKIE = "sse_vault_oauth_state";

export interface VaultSessionUser {
  sub: string;
  name: string;
  username: string | null;
  email: string;
  image: string | null;
  discordId: string | null;
  sseRole: string;
}

export interface StoredVaultSession {
  user: VaultSessionUser;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: number;
}

function normalizeUrl(raw?: string | null): string {
  const cleaned = (raw || "").trim().replace(/\/+$/, "");
  if (!cleaned) return "";
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

export function getAccountsBaseUrl(): string {
  return (
    normalizeUrl(process.env.SSE_ISSUER_URL) ||
    normalizeUrl(process.env.SSE_ACCOUNTS_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL) ||
    "https://sse-account.vercel.app"
  );
}

export function getAppBaseUrl(): string {
  return (
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeUrl(process.env.BETTER_AUTH_URL) ||
    normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeUrl(process.env.VERCEL_URL) ||
    "http://localhost:3000"
  );
}

export function getOAuthClientId(): string {
  return (
    process.env.SSE_CLIENT_ID ||
    process.env.SSE_OAUTH_CLIENT_ID ||
    ""
  ).trim();
}

export function getOAuthClientSecret(): string {
  return (
    process.env.SSE_CLIENT_SECRET ||
    process.env.SSE_OAUTH_CLIENT_SECRET ||
    ""
  ).trim();
}

function getSessionSecret(): Buffer {
  const raw =
    (process.env.SESSION_SECRET || "").trim() ||
    (process.env.BETTER_AUTH_SECRET || "").trim() ||
    getOAuthClientSecret() ||
    "sse-vault-dev-fallback-secret-change-in-production";
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptCookiePayload(data: unknown): string {
  const key = getSessionSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptCookiePayload<T>(token: string): T | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const key = getSessionSecret();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export const MOBILE_APP_SCHEME = "ssevault";

/** True when the request comes from the native SSE Vault app. */
export async function isNativeClient(): Promise<boolean> {
  try {
    const h = await headers();
    return h.get("x-sse-client") === "native";
  } catch {
    return false;
  }
}

export async function getSession(): Promise<StoredVaultSession | null> {
  const jar = await cookies();
  let raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) {
    // Native app: the encrypted session payload is sent as a Bearer token.
    try {
      const auth = (await headers()).get("authorization") || "";
      if (/^Bearer\s+/i.test(auth)) raw = auth.replace(/^Bearer\s+/i, "").trim();
    } catch {
      /* no request context */
    }
  }
  if (!raw) return null;
  const session = decryptCookiePayload<StoredVaultSession>(raw);
  if (!session || !session.user?.sub) return null;
  if (session.expiresAt && Date.now() > session.expiresAt) return null;
  return session;
}

export function getCookieSecurityOptions(maxAgeSeconds: number) {
  const appUrl = getAppBaseUrl();
  const secure =
    appUrl.startsWith("https://") || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
