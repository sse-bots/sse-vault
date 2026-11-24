export type VaultAuthType = "password" | "oauth";

export type VaultCategory =
  | "personal"
  | "work"
  | "dev"
  | "gaming"
  | "finance"
  | "social"
  | "other";

export type VaultDecryptionStatus =
  | "ok"
  | "recovered_db_hex"
  | "recovered_legacy_env"
  | "locked";

export interface VaultSecurityCodeDTO {
  id: string;
  /** Plaintext code when unused & decoded; null when used or locked */
  code: string | null;
  /** Exact-length dash mask ("-------") matching the code's character length */
  masked: string;
  length: number;
  used: boolean;
  usedAt: string | null;
  locked: boolean;
}

export interface VaultItemDTO {
  id: string;
  domainKey: string;
  appName: string;
  label: string;
  url: string;
  /** "password" (standard login) or "oauth" (Sign in with Google/GitHub/Discord/etc. — email only) */
  authType: VaultAuthType;
  /** Provider name when authType === "oauth" (e.g. "Google", "GitHub", "Discord") */
  oauthProvider: string | null;
  category: VaultCategory;
  hasPasskey: boolean;
  email: string | null;
  username: string | null;
  password: string | null;
  totpSecret: string | null;
  securityCodes: VaultSecurityCodeDTO[];
  notes: string | null;
  favorite: boolean;
  keyFingerprint: string | null;
  /** Only non-"ok" when VAULT_ENCRYPTION_SECRET changed and couldn't directly decode this entry */
  decryptionStatus: VaultDecryptionStatus;
  hasStoredHexcode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredSecurityCode {
  id: string;
  encryptedCode: string;
  length: number;
  used: boolean;
  usedAt: Date | null;
  /** Optional per-code hexcode fallback if appended after a secret rotation */
  hexcode?: string | null;
}

export interface VaultAppGroupSummary {
  domainKey: string;
  appName: string;
  accountCount: number;
  oauthCount: number;
  totpCount: number;
  unusedCodesCount: number;
  totalCodesCount: number;
  hasFavorite: boolean;
  hasLockedOrRecovered: boolean;
  categories: VaultCategory[];
  previewIdentities: string[];
  latestUpdatedAt: string;
}

export const OAUTH_PROVIDER_PRESETS: Array<{
  name: string;
  domain: string;
}> = [
  { name: "Google", domain: "google.com" },
  { name: "GitHub", domain: "github.com" },
  { name: "Discord", domain: "discord.com" },
  { name: "Microsoft", domain: "microsoft.com" },
  { name: "Apple", domain: "apple.com" },
  { name: "SSE Accounts", domain: "sse-account.vercel.app" },
];

export const VAULT_CATEGORIES: Array<{
  id: VaultCategory;
  label: string;
  color: string;
}> = [
  { id: "personal", label: "Personal", color: "#f59e0b" },
  { id: "dev", label: "Developer", color: "#06b6d4" },
  { id: "gaming", label: "Gaming", color: "#a855f7" },
  { id: "work", label: "Work", color: "#3b82f6" },
  { id: "social", label: "Social", color: "#ec4899" },
  { id: "finance", label: "Finance", color: "#10b981" },
  { id: "other", label: "Other", color: "#71717a" },
];
