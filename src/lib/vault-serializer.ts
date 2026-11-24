import type { Document } from "mongodb";
import { decryptWithFallback, type DecryptionSource } from "./crypto";
import { extractDomainKey, getAppNameForDomain } from "./domain";
import type {
  StoredSecurityCode,
  VaultAuthType,
  VaultCategory,
  VaultDecryptionStatus,
  VaultItemDTO,
  VaultSecurityCodeDTO,
} from "./vault-types";

const VALID_CATEGORIES = new Set<VaultCategory>([
  "personal",
  "work",
  "dev",
  "gaming",
  "finance",
  "social",
  "other",
]);

function mergeStatus(
  current: VaultDecryptionStatus,
  source: DecryptionSource
): VaultDecryptionStatus {
  if (current === "locked" || source === "locked") return "locked";
  if (current === "recovered_db_hex" || source === "db_hexcode") {
    return "recovered_db_hex";
  }
  if (current === "recovered_legacy_env" || source === "legacy_env") {
    return "recovered_legacy_env";
  }
  return "ok";
}

export function serializeVaultDoc(doc: Document): VaultItemDTO {
  const docHexcode =
    typeof doc.hexcode === "string" && doc.hexcode.trim()
      ? doc.hexcode.trim()
      : null;

  let decryptionStatus: VaultDecryptionStatus = "ok";

  const pwdRes = decryptWithFallback(
    doc.encryptedPassword ? String(doc.encryptedPassword) : null,
    docHexcode
  );
  decryptionStatus = mergeStatus(decryptionStatus, pwdRes.source);

  const totpRes = decryptWithFallback(
    doc.encryptedTotpSecret ? String(doc.encryptedTotpSecret) : null,
    docHexcode
  );
  decryptionStatus = mergeStatus(decryptionStatus, totpRes.source);

  const notesRes = decryptWithFallback(
    doc.encryptedNotes ? String(doc.encryptedNotes) : null,
    docHexcode
  );
  decryptionStatus = mergeStatus(decryptionStatus, notesRes.source);

  const rawCodes: StoredSecurityCode[] = Array.isArray(doc.securityCodes)
    ? (doc.securityCodes as StoredSecurityCode[])
    : [];

  const securityCodes: VaultSecurityCodeDTO[] = rawCodes.map((c) => {
    const used = Boolean(c.used);
    const codeHex =
      typeof c.hexcode === "string" && c.hexcode.trim()
        ? c.hexcode.trim()
        : docHexcode;

    if (used) {
      const len = typeof c.length === "number" && c.length > 0 ? c.length : 8;
      return {
        id: String(c.id),
        code: null,
        masked: "-".repeat(len),
        length: len,
        used: true,
        usedAt: c.usedAt ? new Date(c.usedAt).toISOString() : null,
        locked: false,
      };
    }

    const decoded = decryptWithFallback(c.encryptedCode, codeHex);
    decryptionStatus = mergeStatus(decryptionStatus, decoded.source);
    const isLocked = decoded.source === "locked";
    const length =
      typeof c.length === "number" && c.length > 0
        ? c.length
        : decoded.value
          ? decoded.value.length
          : 8;

    return {
      id: String(c.id),
      code: isLocked ? null : decoded.value,
      masked: "-".repeat(length),
      length,
      used: false,
      usedAt: null,
      locked: isLocked,
    };
  });

  const url = String(doc.url || "");
  const domainKey =
    typeof doc.domainKey === "string" && doc.domainKey.trim()
      ? doc.domainKey.trim().toLowerCase()
      : extractDomainKey(url) || "other";

  const appName =
    typeof doc.appName === "string" && doc.appName.trim()
      ? doc.appName.trim()
      : getAppNameForDomain(domainKey);

  const authType: VaultAuthType =
    doc.authType === "oauth" ? "oauth" : "password";

  const rawCat = String(doc.category || "personal").toLowerCase() as VaultCategory;
  const category: VaultCategory = VALID_CATEGORIES.has(rawCat)
    ? rawCat
    : "personal";

  return {
    id: String(doc._id),
    domainKey,
    appName,
    label: String(doc.label || appName),
    url,
    authType,
    oauthProvider:
      authType === "oauth" && typeof doc.oauthProvider === "string" && doc.oauthProvider.trim()
        ? doc.oauthProvider.trim()
        : null,
    category,
    hasPasskey: Boolean(doc.hasPasskey),
    email: typeof doc.email === "string" && doc.email ? doc.email : null,
    username:
      authType === "oauth"
        ? null
        : typeof doc.username === "string" && doc.username
          ? doc.username
          : null,
    password: authType === "oauth" ? null : pwdRes.value,
    totpSecret: totpRes.value,
    securityCodes,
    notes: notesRes.value,
    favorite: Boolean(doc.favorite),
    keyFingerprint:
      typeof doc.keyFingerprint === "string" ? doc.keyFingerprint : null,
    decryptionStatus,
    hasStoredHexcode: Boolean(docHexcode),
    createdAt: doc.createdAt
      ? new Date(doc.createdAt as string | Date).toISOString()
      : new Date().toISOString(),
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt as string | Date).toISOString()
      : new Date().toISOString(),
  };
}
