import type { Document } from "mongodb";
import { decryptWithFallback, type DecryptionSource } from "./crypto";
import { extractDomainKey, getAppNameForDomain } from "./domain";
import { resolveOAuthProviderDomain } from "./oauth-links";
import type {
  StoredPasswordHistoryItem,
  StoredSecurityCode,
  VaultAuthType,
  VaultCardDetailsDTO,
  VaultCategory,
  VaultCustomFieldDTO,
  VaultDecryptionStatus,
  VaultEntryType,
  VaultItemDTO,
  VaultPasswordHistoryDTO,
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

  let customFields: VaultCustomFieldDTO[] = [];
  if (doc.encryptedCustomFields) {
    const cfRes = decryptWithFallback(String(doc.encryptedCustomFields), docHexcode);
    decryptionStatus = mergeStatus(decryptionStatus, cfRes.source);
    if (cfRes.value) {
      try {
        const parsed: unknown = JSON.parse(cfRes.value);
        if (Array.isArray(parsed)) {
          customFields = (parsed as unknown[])
            .filter(
              (x: unknown): x is Record<string, unknown> =>
                Boolean(x && typeof x === "object")
            )
            .map((x, idx) => ({
              id: String(x.id || `cf_${idx}`),
              label: String(x.label || "").trim(),
              value: String(x.value || ""),
              hidden: Boolean(x.hidden),
            }))
            .filter((x) => x.label || x.value);
        }
      } catch {
        customFields = [];
      }
    }
  }

  let cardDetails: VaultCardDetailsDTO | null = null;
  if (doc.encryptedCardDetails) {
    const cardRes = decryptWithFallback(String(doc.encryptedCardDetails), docHexcode);
    decryptionStatus = mergeStatus(decryptionStatus, cardRes.source);
    if (cardRes.value) {
      try {
        const parsed = JSON.parse(cardRes.value) as Record<string, unknown>;
        cardDetails = {
          cardholderName: String(parsed.cardholderName || ""),
          cardNumber: String(parsed.cardNumber || ""),
          expiry: String(parsed.expiry || ""),
          cvv: String(parsed.cvv || ""),
          billingZip: String(parsed.billingZip || ""),
        };
      } catch {
        cardDetails = null;
      }
    }
  }

  const rawHistory: StoredPasswordHistoryItem[] = Array.isArray(doc.passwordHistory)
    ? (doc.passwordHistory as StoredPasswordHistoryItem[])
    : [];
  const passwordHistory: VaultPasswordHistoryDTO[] = rawHistory.map((h) => {
    const hHex =
      typeof h.hexcode === "string" && h.hexcode.trim()
        ? h.hexcode.trim()
        : docHexcode;
    const dec = decryptWithFallback(h.encryptedPassword, hHex);
    const locked = dec.source === "locked";
    return {
      password: locked ? null : dec.value,
      changedAt: h.changedAt
        ? new Date(h.changedAt).toISOString()
        : new Date().toISOString(),
      locked,
    };
  });

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

  const entryType: VaultEntryType =
    doc.entryType === "note" || doc.entryType === "card"
      ? doc.entryType
      : "login";

  const url =
    String(doc.url || "") ||
    (entryType === "note"
      ? "https://secure-note.local"
      : entryType === "card"
        ? "https://payment-cards.local"
        : "");

  const domainKey =
    typeof doc.domainKey === "string" && doc.domainKey.trim()
      ? doc.domainKey.trim().toLowerCase()
      : entryType === "note"
        ? "secure-note.local"
        : entryType === "card"
          ? "payment-cards.local"
          : extractDomainKey(url) || "other";

  const appName =
    typeof doc.appName === "string" && doc.appName.trim()
      ? doc.appName.trim()
      : getAppNameForDomain(domainKey);

  const authType: VaultAuthType =
    entryType === "login" && doc.authType === "oauth" ? "oauth" : "password";

  const rawCat = String(doc.category || "personal") as VaultCategory;
  const category: VaultCategory = VALID_CATEGORIES.has(rawCat)
    ? rawCat
    : "personal";

  return {
    id: String(doc._id),
    entryType,
    domainKey,
    appName,
    label: String(doc.label || appName),
    url,
    authType,
    oauthProvider:
      authType === "oauth" &&
      typeof doc.oauthProvider === "string" &&
      doc.oauthProvider.trim()
        ? doc.oauthProvider.trim()
        : null,
    oauthProviderDomain:
      authType === "oauth"
        ? typeof doc.oauthProviderDomain === "string" &&
          doc.oauthProviderDomain.trim()
          ? doc.oauthProviderDomain.trim().toLowerCase()
          : resolveOAuthProviderDomain({
              oauthProvider:
                typeof doc.oauthProvider === "string" ? doc.oauthProvider : null,
              oauthProviderDomain: null,
            }) || null
        : null,
    oauthLinkedItemId:
      authType === "oauth" &&
      typeof doc.oauthLinkedItemId === "string" &&
      doc.oauthLinkedItemId.trim()
        ? doc.oauthLinkedItemId.trim()
        : null,
    category,
    hasPasskey: Boolean(doc.hasPasskey),
    email: typeof doc.email === "string" && doc.email ? doc.email : null,
    username:
      typeof doc.username === "string" && doc.username ? doc.username : null,
    password: pwdRes.value,
    totpSecret: totpRes.value,
    securityCodes,
    customFields,
    cardDetails,
    passwordHistory,
    notes: notesRes.value,
    favorite: Boolean(doc.favorite),
    keyFingerprint:
      typeof doc.keyFingerprint === "string" ? doc.keyFingerprint : null,
    decryptionStatus,
    hasStoredHexcode: Boolean(docHexcode),
    deletedAt: doc.deletedAt
      ? new Date(doc.deletedAt as string | Date).toISOString()
      : null,
    createdAt: doc.createdAt
      ? new Date(doc.createdAt as string | Date).toISOString()
      : new Date().toISOString(),
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt as string | Date).toISOString()
      : new Date().toISOString(),
  };
}
