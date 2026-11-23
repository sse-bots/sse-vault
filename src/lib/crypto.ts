import crypto from "crypto";

function getVaultKeyBuffer(): Buffer {
  const raw = (
    process.env.VAULT_ENCRYPTION_SECRET ||
    process.env.KEY_ENCRYPTION_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    "dev-vault-encryption-fallback-change-me"
  ).trim();

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getVaultKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload?: string | null): string | null {
  if (!payload || typeof payload !== "string") return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  try {
    const [ivHex, tagHex, dataHex] = parts;
    const key = getVaultKeyBuffer();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
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

export function generateCodeId(): string {
  return crypto.randomBytes(8).toString("hex");
}
