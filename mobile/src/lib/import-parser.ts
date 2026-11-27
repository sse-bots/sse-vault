import { extractDomainKey, getAppNameForDomain, normalizeWebsiteUrl } from "./domain";
import type { VaultAuthType, VaultCategory, VaultItemDTO } from "./vault-types";

export interface ParsedImportEntry {
  url: string;
  label: string;
  authType: VaultAuthType;
  oauthProvider: string;
  oauthProviderDomain?: string;
  category: VaultCategory;
  hasPasskey: boolean;
  email: string;
  username: string;
  password: string;
  totpSecret: string;
  securityCodes: Array<{ code: string; used?: boolean }>;
  notes: string;
  favorite: boolean;
}

export interface ImportParseResult {
  detectedFormat: string;
  entries: ParsedImportEntry[];
  skippedMalformed: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_CATEGORIES = new Set<VaultCategory>([
  "personal",
  "work",
  "dev",
  "gaming",
  "finance",
  "social",
  "other",
]);

/**
 * RFC-4180 compliant CSV parser (handles quoted commas, escaped quotes "", and multiline notes).
 */
export function parseCsvMatrix(raw: string): string[][] {
  const text = (raw || "").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
    } else if (ch === "\n" || ch === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function pickColumnIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function splitIdentity(rawEmail: string, rawUsername: string): {
  email: string;
  username: string;
} {
  const email = (rawEmail || "").trim();
  const username = (rawUsername || "").trim();
  if (!email && EMAIL_REGEX.test(username)) {
    return { email: username, username: "" };
  }
  if (email && username && email.toLowerCase() === username.toLowerCase()) {
    return { email, username: "" };
  }
  return { email, username };
}

function normalizeCategory(val: unknown): VaultCategory {
  const clean = String(val || "personal").trim().toLowerCase() as VaultCategory;
  return VALID_CATEGORIES.has(clean) ? clean : "personal";
}

function parseJsonImport(rawText: string): ImportParseResult {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const entries: ParsedImportEntry[] = [];
  let skippedMalformed = 0;

  // Format 1: SSE Vault JSON Export ({ entries: [...] })
  if (Array.isArray(parsed.entries)) {
    for (const item of parsed.entries as Array<Record<string, unknown>>) {
      const rawUrl = String(item.url || item.domainKey || "").trim();
      const domain = extractDomainKey(rawUrl);
      if (!rawUrl || !domain) {
        skippedMalformed += 1;
        continue;
      }

      const authType: VaultAuthType =
        item.authType === "oauth" ? "oauth" : "password";

      const rawCodes: Array<{ code: string; used?: boolean }> = [];
      if (Array.isArray(item.securityCodes)) {
        for (const c of item.securityCodes) {
          if (typeof c === "string" && c.trim()) {
            rawCodes.push({ code: c.trim(), used: false });
          } else if (c && typeof c === "object") {
            const obj = c as Record<string, unknown>;
            if (typeof obj.code === "string" && obj.code.trim()) {
              rawCodes.push({
                code: obj.code.trim(),
                used: Boolean(obj.used),
              });
            }
          }
        }
      }

      const { email, username } = splitIdentity(
        String(item.email || ""),
        String(item.username || "")
      );

      entries.push({
        url: normalizeWebsiteUrl(rawUrl),
        label: String(item.label || item.appName || getAppNameForDomain(domain)).trim(),
        authType,
        oauthProvider:
          authType === "oauth" ? String(item.oauthProvider || "Google").trim() : "",
        oauthProviderDomain:
          authType === "oauth" ? String(item.oauthProviderDomain || "").trim().toLowerCase() : "",
        category: normalizeCategory(item.category),
        hasPasskey: Boolean(item.hasPasskey),
        email,
        username: authType === "oauth" ? "" : username,
        password: authType === "oauth" ? "" : String(item.password || ""),
        totpSecret: String(item.totpSecret || "").trim(),
        securityCodes: rawCodes,
        notes: String(item.notes || "").trim(),
        favorite: Boolean(item.favorite),
      });
    }

    return {
      detectedFormat: "SSE Vault JSON",
      entries,
      skippedMalformed,
    };
  }

  // Format 2: Bitwarden JSON Export ({ items: [...] })
  if (Array.isArray(parsed.items)) {
    for (const item of parsed.items as Array<Record<string, unknown>>) {
      const login = (item.login || {}) as Record<string, unknown>;
      const uris = Array.isArray(login.uris)
        ? (login.uris as Array<Record<string, unknown>>)
        : [];
      const rawUrl = String(
        uris[0]?.uri || item.url || ""
      ).trim();
      const domain = extractDomainKey(rawUrl);
      if (!rawUrl || !domain) {
        skippedMalformed += 1;
        continue;
      }

      const { email, username } = splitIdentity(
        "",
        String(login.username || "")
      );

      entries.push({
        url: normalizeWebsiteUrl(rawUrl),
        label: String(item.name || getAppNameForDomain(domain)).trim(),
        authType: "password",
        oauthProvider: "",
        category: "personal",
        hasPasskey: false,
        email,
        username,
        password: String(login.password || ""),
        totpSecret: String(login.totp || "").trim(),
        securityCodes: [],
        notes: String(item.notes || "").trim(),
        favorite: Boolean(item.favorite),
      });
    }

    return {
      detectedFormat: "Bitwarden JSON",
      entries,
      skippedMalformed,
    };
  }

  throw new Error(
    "Unsupported JSON structure. Expected an SSE Vault JSON backup or Bitwarden JSON export."
  );
}

function parseCsvImport(rawText: string): ImportParseResult {
  const matrix = parseCsvMatrix(rawText);
  if (matrix.length < 2) {
    throw new Error("CSV file has no password rows to import.");
  }

  const headers = matrix[0].map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_")
  );

  const urlIdx = pickColumnIndex(headers, [
    "url",
    "login_uri",
    "uri",
    "website",
    "origin",
    "homepage",
    "web_site",
    "site",
  ]);
  const nameIdx = pickColumnIndex(headers, [
    "name",
    "title",
    "label",
    "service",
    "account",
  ]);
  const emailIdx = pickColumnIndex(headers, [
    "email",
    "e-mail",
    "login_email",
  ]);
  const userIdx = pickColumnIndex(headers, [
    "username",
    "login_username",
    "user",
    "login",
    "user_name",
  ]);
  const passIdx = pickColumnIndex(headers, [
    "password",
    "login_password",
    "pass",
  ]);
  const totpIdx = pickColumnIndex(headers, [
    "totp",
    "login_totp",
    "otpauth",
    "otp",
    "totpsecret",
    "totp_secret",
    "2fa",
  ]);
  const notesIdx = pickColumnIndex(headers, [
    "note",
    "notes",
    "extra",
    "comment",
    "comments",
  ]);
  const authTypeIdx = pickColumnIndex(headers, ["authtype", "auth_type"]);
  const oauthProvIdx = pickColumnIndex(headers, [
    "oauthprovider",
    "oauth_provider",
  ]);
  const categoryIdx = pickColumnIndex(headers, ["category", "folder"]);

  if (urlIdx === -1) {
    throw new Error(
      "Could not find a URL column in this CSV. Supported exports: Chrome, Edge, Firefox, Safari/iCloud, Bitwarden, 1Password, SSE Vault."
    );
  }

  let detectedFormat = "Universal Password CSV";
  if (headers.includes("login_uri")) detectedFormat = "Bitwarden CSV";
  else if (headers.includes("otpauth") && headers.includes("title"))
    detectedFormat = "Apple iCloud / Safari CSV";
  else if (headers.includes("httprealm") || headers.includes("formactionorigin"))
    detectedFormat = "Firefox Passwords CSV";
  else if (headers.includes("authtype") || headers.includes("oauthprovider"))
    detectedFormat = "SSE Vault CSV";
  else if (headers.includes("name") && headers.includes("url") && headers.includes("password"))
    detectedFormat = "Chrome / Edge / Brave CSV";

  const entries: ParsedImportEntry[] = [];
  let skippedMalformed = 0;

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    const get = (idx: number) => (idx >= 0 && idx < row.length ? row[idx].trim() : "");

    // Bitwarden CSV includes non-login items (notes/cards) — skip empty URL rows
    const rawUrl = get(urlIdx).split(",")[0].trim();
    const domain = extractDomainKey(rawUrl);
    if (!rawUrl || !domain) {
      skippedMalformed += 1;
      continue;
    }

    const rawAuthType = get(authTypeIdx).toLowerCase();
    const authType: VaultAuthType = rawAuthType === "oauth" ? "oauth" : "password";
    const oauthProvider = authType === "oauth" ? get(oauthProvIdx) || "Google" : "";

    const { email, username } = splitIdentity(get(emailIdx), get(userIdx));
    const password = authType === "oauth" ? "" : get(passIdx);
    const totpSecret = get(totpIdx);
    const label = get(nameIdx) || getAppNameForDomain(domain);
    const notes = get(notesIdx);
    const category = normalizeCategory(get(categoryIdx));

    if (!email && !username && !password && !totpSecret) {
      skippedMalformed += 1;
      continue;
    }

    entries.push({
      url: normalizeWebsiteUrl(rawUrl),
      label,
      authType,
      oauthProvider,
      category,
      hasPasskey: false,
      email,
      username: authType === "oauth" ? "" : username,
      password,
      totpSecret,
      securityCodes: [],
      notes,
      favorite: false,
    });
  }

  return { detectedFormat, entries, skippedMalformed };
}

export function parsePasswordImportFile(
  fileName: string,
  rawText: string
): ImportParseResult {
  const trimmed = (rawText || "").replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new Error("The selected file is empty.");
  }

  const looksJson =
    fileName.toLowerCase().endsWith(".json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (looksJson) {
    return parseJsonImport(trimmed);
  }
  return parseCsvImport(trimmed);
}

function csvEscape(value: string | null | undefined): string {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function serializeVaultItemsToCsv(items: VaultItemDTO[]): string {
  const header = [
    "name",
    "url",
    "username",
    "email",
    "password",
    "totp",
    "auth_type",
    "oauth_provider",
    "category",
    "note",
  ].join(",");

  const lines = items.map((item) =>
    [
      csvEscape(item.label || item.appName),
      csvEscape(item.url),
      csvEscape(item.username || item.email || ""),
      csvEscape(item.email || ""),
      csvEscape(item.authType === "oauth" ? "" : item.password || ""),
      csvEscape(item.totpSecret || ""),
      csvEscape(item.authType),
      csvEscape(item.oauthProvider || ""),
      csvEscape(item.category),
      csvEscape(item.notes || ""),
    ].join(",")
  );

  return [header, ...lines].join("\r\n");
}
