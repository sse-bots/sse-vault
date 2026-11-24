import crypto from "crypto";

export type DecryptionSource =
  | "empty"
  | "primary"
  | "legacy_env"
  | "db_hexcode"
  | "locked";

export function normalizeHexKey(raw: string): string {
  const cleaned = (raw || "").trim();
  if (/^[0-9a-fA-F]{64}$/.test(cleaned)) {
    return cleaned.toLowerCase();
  }
  return crypto.createHash("sha256").update(cleaned, "utf8").digest("hex");
}

export function getActiveKeyHex(): string {
  const raw = (
    process.env.VAULT_ENCRYPTION_SECRET ||
    process.env.KEY_ENCRYPTION_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    "dev-vault-encryption-fallback-change-me"
  ).trim();
  return normalizeHexKey(raw);
}

export function getKeyFingerprint(hexKey?: string): string {
  const target = hexKey ? normalizeHexKey(hexKey) : getActiveKeyHex();
  return crypto
    .createHash("sha256")
    .update(target, "utf8")
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
}

export function shouldStoreHexcodeInDb(): boolean {
  const flag = (process.env.VAULT_STORE_HEXCODE_IN_DB || "true")
    .trim()
    .toLowerCase();
  return flag !== "false" && flag !== "0" && flag !== "no";
}

export function getLegacyEnvKeys(): string[] {
  const raw = (process.env.VAULT_LEGACY_ENCRYPTION_SECRETS || "").trim();
  if (!raw) return [];
  const active = getActiveKeyHex();
  const seen = new Set<string>([active]);
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const normalized = normalizeHexKey(trimmed);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

export function encryptSecretWithKey(
  plaintext: string,
  hexKey?: string
): string {
  const keyBuf = Buffer.from(
    hexKey ? normalizeHexKey(hexKey) : getActiveKeyHex(),
    "hex"
  );
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function encryptSecret(plaintext: string): string {
  return encryptSecretWithKey(plaintext, getActiveKeyHex());
}

export function decryptSecretWithKey(
  payload: string | null | undefined,
  hexKey: string
): string | null {
  if (!payload || typeof payload !== "string") return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  try {
    const [ivHex, tagHex, dataHex] = parts;
    const keyBuf = Buffer.from(normalizeHexKey(hexKey), "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      keyBuf,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Primary-first decryption with conditional fallback:
 *  1. Always attempts current VAULT_ENCRYPTION_SECRET first.
 *  2. ONLY if step 1 fails, tries VAULT_LEGACY_ENCRYPTION_SECRETS.
 *  3. ONLY if steps 1 & 2 fail, uses the record's stored MongoDB `hexcode` field.
 *  4. If all keys fail, marks the field as "locked" so the user can recover it with an old hex key.
 */
export function decryptWithFallback(
  payload: string | null | undefined,
  docHexcode?: string | null
): { value: string | null; source: DecryptionSource } {
  if (!payload || typeof payload !== "string") {
    return { value: null, source: "empty" };
  }

  const activeHex = getActiveKeyHex();
  const primaryRes = decryptSecretWithKey(payload, activeHex);
  if (primaryRes !== null) {
    return { value: primaryRes, source: "primary" };
  }

  for (const legacyHex of getLegacyEnvKeys()) {
    const legacyRes = decryptSecretWithKey(payload, legacyHex);
    if (legacyRes !== null) {
      return { value: legacyRes, source: "legacy_env" };
    }
  }

  if (docHexcode && typeof docHexcode === "string" && docHexcode.trim()) {
    const dbRes = decryptSecretWithKey(payload, docHexcode.trim());
    if (dbRes !== null) {
      return { value: dbRes, source: "db_hexcode" };
    }
  }

  return { value: null, source: "locked" };
}

export function generateCodeId(): string {
  return crypto.randomBytes(8).toString("hex");
}
