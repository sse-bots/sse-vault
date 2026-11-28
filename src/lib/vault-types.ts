export type VaultAuthType = "password" | "oauth";
export type VaultEntryType = "login" | "note" | "card";

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
  code: string | null;
  masked: string;
  length: number;
  used: boolean;
  usedAt: string | null;
  locked: boolean;
}

export interface VaultCustomFieldDTO {
  id: string;
  label: string;
  value: string;
  hidden: boolean;
}

export interface VaultCardDetailsDTO {
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  billingZip: string;
}

export interface VaultPasswordHistoryDTO {
  password: string | null;
  changedAt: string;
  locked: boolean;
}

export interface VaultItemDTO {
  id: string;
  entryType: VaultEntryType;
  domainKey: string;
  appName: string;
  label: string;
  url: string;
  authType: VaultAuthType;
  oauthProvider: string | null;
  oauthProviderDomain: string | null;
  oauthLinkedItemId: string | null;
  category: VaultCategory;
  hasPasskey: boolean;
  email: string | null;
  username: string | null;
  password: string | null;
  totpSecret: string | null;
  securityCodes: VaultSecurityCodeDTO[];
  customFields: VaultCustomFieldDTO[];
  cardDetails: VaultCardDetailsDTO | null;
  passwordHistory: VaultPasswordHistoryDTO[];
  notes: string | null;
  favorite: boolean;
  keyFingerprint: string | null;
  decryptionStatus: VaultDecryptionStatus;
  hasStoredHexcode: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredSecurityCode {
  id: string;
  encryptedCode: string;
  length: number;
  used: boolean;
  usedAt: Date | null;
  hexcode?: string | null;
}

export interface StoredPasswordHistoryItem {
  encryptedPassword: string;
  changedAt: Date | string;
  hexcode?: string | null;
}

export interface VaultActivityDTO {
  id: string;
  event: string;
  label: string;
  client: "web" | "native";
  userAgent: string | null;
  createdAt: string;
}

export interface VaultAppGroupSummary {
  domainKey: string;
  appName: string;
  entryTypes: VaultEntryType[];
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
