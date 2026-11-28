/**
 * Smart Recovery / Backup Security Code parser for .txt files and pasted text.
 * Supports GitHub, Discord, Google, Microsoft, Cloudflare, and SSE Accounts .txt kits.
 * Always runs in memory — the uploaded .txt file is NEVER persisted to disk or database.
 */

const HEADER_LINE_PATTERNS = [
  /^save\s+your/i,
  /^backup\s+(verification\s+)?codes?/i,
  /^recovery\s+codes?/i,
  /^two[-\s]?step/i,
  /^2fa\s+/i,
  /^account\s*:/i,
  /^email\s*:/i,
  /^username\s*:/i,
  /^generated\s*:/i,
  /^created\s*:/i,
  /^date\s*:/i,
  /^each\s+code/i,
  /^store\s+this/i,
  /^keep\s+these/i,
  /^note\s*:/i,
  /^https?:\/\//i,
  /^\*+\s*$/,
  /^[-=_]{4,}\s*$/,
];

function isLikelyHeaderLine(line: string): boolean {
  if (!line) return true;
  if (HEADER_LINE_PATTERNS.some((rx) => rx.test(line))) return true;
  // Long English prose sentences (5+ normal dictionary-like words with spaces and no digits)
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length >= 5 && !/\d/.test(line)) return true;
  return false;
}

function looksLikeSecurityCode(token: string): boolean {
  const clean = token.trim();
  if (clean.length < 4 || clean.length > 64) return false;
  // Must contain at least one alphanumeric character
  if (!/[a-zA-Z0-9]/.test(clean)) return false;
  // Reject pure punctuation or dashes
  if (/^[-_.,:;*#]+$/.test(clean)) return false;
  return true;
}

export function extractSecurityCodesFromText(rawText: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const pushCode = (candidate: string) => {
    const clean = candidate.trim().replace(/^[,;]+|[,;]+$/g, "");
    if (!looksLikeSecurityCode(clean)) return;
    if (!seen.has(clean)) {
      seen.add(clean);
      results.push(clean);
    }
  };

  const lines = (rawText || "").replace(/\r\n/g, "\n").split("\n");

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || isLikelyHeaderLine(line)) continue;

    // Strip leading numbering / bullet / checkbox prefixes:
    // e.g. "01. abcd-efgh", "1) abcd-efgh", "- [ ] 1234 5678", "* 12345678"
    line = line
      .replace(/^(?:[-*•]\s*)?(?:\[\s*[xX ]?\s*\]\s*)?/, "")
      .replace(/^\d{1,3}[.)]\s+/, "")
      .trim();

    if (!line || isLikelyHeaderLine(line)) continue;

    // Handle Google-style 2-column numeric codes: "1234 5678   8765 4321"
    if (/\t|\s{2,}/.test(line)) {
      const cols = line
        .split(/\t+|\s{2,}/)
        .map((c) => c.trim())
        .filter(Boolean);
      for (const col of cols) {
        const cleanedCol = col.replace(/^\d{1,3}[.)]\s+/, "").trim();
        pushCode(cleanedCol);
      }
      continue;
    }

    // Handle comma or semicolon separated codes on one line
    if (/[,;]/.test(line)) {
      const parts = line
        .split(/[,;]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const part of parts) {
        pushCode(part);
      }
      continue;
    }

    // Handle single Google-style spaced 8-digit code ("1234 5678") vs multiple distinct codes
    if (/^\d{4}\s+\d{4}$/.test(line)) {
      pushCode(line);
      continue;
    }

    // Handle space-separated code tokens on one line (e.g., "abc12-def34 ghi56-jkl78")
    const spaceParts = line.split(/\s+/).filter(Boolean);
    if (
      spaceParts.length > 1 &&
      spaceParts.every((p) => p.length >= 6 && /[0-9]/.test(p))
    ) {
      for (const part of spaceParts) {
        pushCode(part);
      }
      continue;
    }

    // Otherwise treat the cleaned line as one recovery code
    pushCode(line);
  }

  return results;
}

export function maskUsedCode(length: number): string {
  return "-".repeat(Math.max(4, length));
}

export function inferLabelFromUrl(url: string): string {
  const cleaned = (url || "").trim();
  if (!cleaned) return "Untitled Account";
  try {
    const withProto = /^https?:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;
    const host = new URL(withProto).hostname.replace(/^www\./i, "");
    const base = host.split(".")[0] || host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return cleaned.slice(0, 40);
  }
}

export function normalizeDisplayUrl(url: string): string {
  const cleaned = (url || "").trim();
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}
