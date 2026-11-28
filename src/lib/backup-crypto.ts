import crypto from "crypto";

export interface EncryptedVaultBackupEnvelope {
  format: "sse-vault-encrypted";
  version: 1;
  kdf: "pbkdf2-sha256";
  iterations: number;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

const DEFAULT_ITERATIONS = 120_000;

export function encryptVaultBackup(
  plaintextJson: string,
  passphrase: string
): EncryptedVaultBackupEnvelope {
  const cleanPass = passphrase.trim();
  if (cleanPass.length < 6) {
    throw new Error("Backup passphrase must be at least 6 characters.");
  }
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(cleanPass, salt, DEFAULT_ITERATIONS, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintextJson, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    format: "sse-vault-encrypted",
    version: 1,
    kdf: "pbkdf2-sha256",
    iterations: DEFAULT_ITERATIONS,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: encrypted.toString("base64"),
  };
}

export function decryptVaultBackup(rawText: string, passphrase: string): string {
  let env: EncryptedVaultBackupEnvelope;
  try {
    env = JSON.parse(rawText) as EncryptedVaultBackupEnvelope;
  } catch {
    throw new Error("Invalid .ssevault encrypted backup file.");
  }
  if (
    !env ||
    env.format !== "sse-vault-encrypted" ||
    env.version !== 1 ||
    !env.salt ||
    !env.iv ||
    !env.tag ||
    !env.ciphertext
  ) {
    throw new Error("Unrecognized .ssevault backup format.");
  }

  const iterations =
    typeof env.iterations === "number" &&
    env.iterations >= 10_000 &&
    env.iterations <= 500_000
      ? env.iterations
      : DEFAULT_ITERATIONS;

  const key = crypto.pbkdf2Sync(
    passphrase.trim(),
    Buffer.from(env.salt, "hex"),
    iterations,
    32,
    "sha256"
  );
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(env.iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(env.tag, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(env.ciphertext, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error("Wrong backup passphrase or corrupted .ssevault file.");
  }
}
