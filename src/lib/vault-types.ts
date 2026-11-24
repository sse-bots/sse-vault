export interface VaultSecurityCodeDTO {
  id: string;
  /** Plaintext code when unused; null when already used */
  code: string | null;
  /** Exact-length dash mask ("-------") matching the code's character length */
  masked: string;
  length: number;
  used: boolean;
  usedAt: string | null;
}

export interface VaultItemDTO {
  id: string;
  /** Canonical root domain used for automatic app grouping (e.g. "github.com", "google.com") */
  domainKey: string;
  /** Friendly App Name (e.g. "GitHub", "Google") */
  appName: string;
  /** Optional account nickname / label */
  label: string;
  url: string;
  email: string | null;
  username: string | null;
  password: string | null;
  totpSecret: string | null;
  securityCodes: VaultSecurityCodeDTO[];
  notes: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredSecurityCode {
  id: string;
  encryptedCode: string;
  length: number;
  used: boolean;
  usedAt: Date | null;
}

export interface VaultAppGroupSummary {
  domainKey: string;
  appName: string;
  accountCount: number;
  totpCount: number;
  unusedCodesCount: number;
  totalCodesCount: number;
  hasFavorite: boolean;
  previewIdentities: string[];
  latestUpdatedAt: string;
}
