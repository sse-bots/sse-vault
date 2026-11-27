export type Category =
  | "personal" | "work" | "dev" | "gaming" | "finance" | "social" | "other";

export const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: "personal", label: "Personal", color: "#f59e0b" },
  { id: "dev", label: "Developer", color: "#06b6d4" },
  { id: "gaming", label: "Gaming", color: "#a855f7" },
  { id: "work", label: "Work", color: "#3b82f6" },
  { id: "social", label: "Social", color: "#ec4899" },
  { id: "finance", label: "Finance", color: "#10b981" },
  { id: "other", label: "Other", color: "#71717a" },
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

export interface VaultItem {
  id: string;
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
  notes: string | null;
  favorite: boolean;
  decryptionStatus: "ok" | "recovered_db_hex" | "recovered_legacy_env" | "locked";
  updatedAt: string;
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
  label?: string;
  url?: string;
  authType?: "password" | "oauth";
  oauthProvider?: string;
  category?: Category;
  hasPasskey?: boolean;
  email?: string;
  username?: string;
  password?: string;
  totpSecret?: string;
  notes?: string;
  favorite?: boolean;
  securityCodes?: string[];
}
