export type Category =
  | "personal"
  | "work"
  | "dev"
  | "gaming"
  | "finance"
  | "social"
  | "other";

export type EntryType = "login" | "note" | "card";

export const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: "personal", label: "Personal", color: "#f59e0b" },
  { id: "dev", label: "Developer", color: "#06b6d4" },
  { id: "gaming", label: "Gaming", color: "#a855f7" },
  { id: "work", label: "Work", color: "#3b82f6" },
  { id: "social", label: "Social", color: "#ec4899" },
  { id: "finance", label: "Finance", color: "#10b981" },
  { id: "other", label: "Other", color: "#71717a" },
];

export const OAUTH_PROVIDER_PRESETS: Array<{ name: string; domain: string }> = [
  { name: "Google", domain: "google.com" },
  { name: "GitHub", domain: "github.com" },
  { name: "Discord", domain: "discord.com" },
  { name: "Microsoft", domain: "microsoft.com" },
  { name: "Apple", domain: "apple.com" },
  { name: "SSE Accounts", domain: "sse-account.vercel.app" },
];

export interface SecurityCode {
  id: string;
  code: string | null;
  masked: string;
  length: number;
  used: boolean;
  usedAt: string | null;
  locked: boolean;
}

export interface CustomField {
  id: string;
  label: string;
  value: string;
  hidden: boolean;
}

export interface CardDetails {
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  billingZip: string;
}

export interface PasswordHistoryItem {
  password: string | null;
  changedAt: string;
  locked: boolean;
}

export interface VaultItem {
  id: string;
  entryType: EntryType;
  domainKey: string;
  appName: string;
  label: string;
  url: string;
  authType: "password" | "oauth";
  oauthProvider: string | null;
  oauthProviderDomain: string | null;
  oauthLinkedItemId: string | null;
  category: Category;
  hasPasskey: boolean;
  email: string | null;
  username: string | null;
  password: string | null;
  totpSecret: string | null;
  securityCodes: SecurityCode[];
  customFields: CustomField[];
  cardDetails: CardDetails | null;
  passwordHistory: PasswordHistoryItem[];
  notes: string | null;
  favorite: boolean;
  decryptionStatus:
    | "ok"
    | "recovered_db_hex"
    | "recovered_legacy_env"
    | "locked";
  deletedAt?: string | null;
  updatedAt: string;
}

export interface TrashedItem extends VaultItem {
  daysRemaining: number;
}

export interface ActivityEvent {
  id: string;
  event: string;
  label: string;
  client: "web" | "native";
  userAgent: string | null;
  createdAt: string;
}

export interface PinStatus {
  hasPin: boolean;
  unlocked: boolean;
  autoLockMinutes: number;
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface VaultUser {
  userId: string;
  name: string;
  username: string | null;
  email: string;
  image: string | null;
  sseRole: string;
}

export interface ItemInput {
  entryType?: EntryType;
  label?: string;
  url?: string;
  expectedDomain?: string;
  authType?: "password" | "oauth";
  oauthProvider?: string;
  oauthProviderDomain?: string;
  oauthLinkedItemId?: string;
  category?: Category;
  hasPasskey?: boolean;
  email?: string;
  username?: string;
  password?: string;
  totpSecret?: string;
  customFields?: CustomField[];
  cardDetails?: CardDetails | null;
  notes?: string;
  favorite?: boolean;
  securityCodesMode?: "keep" | "append" | "replace";
  securityCodes?: string[];
}
