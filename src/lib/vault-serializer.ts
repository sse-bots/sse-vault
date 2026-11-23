import type { Document } from "mongodb";
import { decryptSecret } from "./crypto";
import type {
  StoredSecurityCode,
  VaultItemDTO,
  VaultSecurityCodeDTO,
} from "./vault-types";

export function serializeVaultDoc(doc: Document): VaultItemDTO {
  const rawCodes: StoredSecurityCode[] = Array.isArray(doc.securityCodes)
    ? (doc.securityCodes as StoredSecurityCode[])
    : [];

  const securityCodes: VaultSecurityCodeDTO[] = rawCodes.map((c) => {
    const used = Boolean(c.used);
    const decrypted = used ? null : decryptSecret(c.encryptedCode);
    const length =
      typeof c.length === "number" && c.length > 0
        ? c.length
        : decrypted
          ? decrypted.length
          : 8;

    return {
      id: String(c.id),
      code: used ? null : decrypted,
      masked: "-".repeat(length),
      length,
      used,
      usedAt: c.usedAt ? new Date(c.usedAt).toISOString() : null,
    };
  });

  return {
    id: String(doc._id),
    label: String(doc.label || "Untitled"),
    url: String(doc.url || ""),
    email: typeof doc.email === "string" && doc.email ? doc.email : null,
    username:
      typeof doc.username === "string" && doc.username ? doc.username : null,
    password: doc.encryptedPassword
      ? decryptSecret(String(doc.encryptedPassword))
      : null,
    totpSecret: doc.encryptedTotpSecret
      ? decryptSecret(String(doc.encryptedTotpSecret))
      : null,
    securityCodes,
    notes: doc.encryptedNotes ? decryptSecret(String(doc.encryptedNotes)) : null,
    favorite: Boolean(doc.favorite),
    createdAt: doc.createdAt
      ? new Date(doc.createdAt as string | Date).toISOString()
      : new Date().toISOString(),
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt as string | Date).toISOString()
      : new Date().toISOString(),
  };
}
