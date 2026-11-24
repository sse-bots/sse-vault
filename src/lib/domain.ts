/**
 * Smart domain normalization, brand recognition, and favicon URL resolution.
 * Ensures `accounts.google.com`, `mail.google.com`, and `https://google.com`
 * all segregate cleanly into the single `google.com` ("Google") app group.
 */

const MULTI_PART_TLDS = new Set([
  "co.in",
  "org.in",
  "net.in",
  "ac.in",
  "gov.in",
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.jp",
  "ne.jp",
  "or.jp",
  "com.br",
  "com.sg",
  "com.mx",
  "co.nz",
  "co.za",
  "com.hk",
  "com.tw",
  "com.tr",
  "co.kr",
]);

const DOMAIN_ALIASES: Record<string, string> = {
  "youtu.be": "youtube.com",
  "discordapp.com": "discord.com",
  "discord.gg": "discord.com",
  "fb.com": "facebook.com",
  "twitter.com": "x.com",
  "t.co": "x.com",
  "amzn.to": "amazon.com",
  "wa.me": "whatsapp.com",
  "live.com": "microsoft.com",
  "outlook.com": "microsoft.com",
  "office.com": "microsoft.com",
  "gmail.com": "google.com",
  "googleapis.com": "google.com",
  "githubusercontent.com": "github.com",
  "github.io": "github.com",
};

const KNOWN_APP_NAMES: Record<string, string> = {
  "google.com": "Google",
  "github.com": "GitHub",
  "discord.com": "Discord",
  "vercel.com": "Vercel",
  "vercel.app": "Vercel App",
  "microsoft.com": "Microsoft",
  "apple.com": "Apple",
  "icloud.com": "iCloud",
  "amazon.com": "Amazon",
  "amazon.in": "Amazon India",
  "youtube.com": "YouTube",
  "x.com": "X (Twitter)",
  "instagram.com": "Instagram",
  "facebook.com": "Facebook",
  "whatsapp.com": "WhatsApp",
  "telegram.org": "Telegram",
  "linkedin.com": "LinkedIn",
  "reddit.com": "Reddit",
  "openai.com": "OpenAI",
  "chatgpt.com": "ChatGPT",
  "anthropic.com": "Anthropic",
  "claude.ai": "Claude",
  "cloudflare.com": "Cloudflare",
  "mongodb.com": "MongoDB",
  "render.com": "Render",
  "resend.com": "Resend",
  "netlify.com": "Netlify",
  "supabase.com": "Supabase",
  "firebase.google.com": "Firebase",
  "stripe.com": "Stripe",
  "paypal.com": "PayPal",
  "notion.so": "Notion",
  "figma.com": "Figma",
  "spotify.com": "Spotify",
  "netflix.com": "Netflix",
  "steam.com": "Steam",
  "steampowered.com": "Steam",
  "epicgames.com": "Epic Games",
  "minecraft.net": "Minecraft",
  "twitch.tv": "Twitch",
  "proton.me": "Proton",
  "protonmail.com": "Proton Mail",
  "bitwarden.com": "Bitwarden",
  "gitlab.com": "GitLab",
  "bitbucket.org": "Bitbucket",
  "npmjs.com": "npm",
  "docker.com": "Docker",
  "heroku.com": "Heroku",
  "digitalocean.com": "DigitalOcean",
  "hostinger.com": "Hostinger",
  "godaddy.com": "GoDaddy",
  "namecheap.com": "Namecheap",
};

/** Platform hosting suffixes where each subdomain is its own distinct website/app */
const PLATFORM_HOST_SUFFIXES = new Set([
  "vercel.app",
  "netlify.app",
  "onrender.com",
  "pages.dev",
  "web.app",
  "firebaseapp.com",
  "herokuapp.com",
  "railway.app",
  "fly.dev",
]);

export function normalizeWebsiteUrl(raw: string): string {
  const cleaned = (raw || "").trim();
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

export function extractHostname(rawUrl: string): string {
  const cleaned = (rawUrl || "").trim();
  if (!cleaned) return "";
  try {
    const u = new URL(normalizeWebsiteUrl(cleaned));
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return cleaned
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split(/[/?#:]/)[0]
      .trim();
  }
}

export function extractDomainKey(rawUrl: string): string {
  const host = extractHostname(rawUrl);
  if (!host) return "";

  // IPv4 or localhost stays as-is
  if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return host;
  }

  // Direct alias check
  if (DOMAIN_ALIASES[host]) {
    return DOMAIN_ALIASES[host];
  }

  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) {
    return DOMAIN_ALIASES[host] || host;
  }

  const lastTwo = parts.slice(-2).join(".");

  // Keep distinct hosted apps separate (e.g. sse-account.vercel.app vs sse-nexus.vercel.app)
  if (PLATFORM_HOST_SUFFIXES.has(lastTwo)) {
    return parts.slice(-3).join(".");
  }

  // Handle multi-part public suffixes like .co.in, .co.uk
  if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) {
    const root3 = parts.slice(-3).join(".");
    return DOMAIN_ALIASES[root3] || root3;
  }

  return DOMAIN_ALIASES[lastTwo] || lastTwo;
}

export function getAppNameForDomain(domainKey: string): string {
  const clean = (domainKey || "").trim().toLowerCase();
  if (!clean) return "Untitled App";
  if (KNOWN_APP_NAMES[clean]) return KNOWN_APP_NAMES[clean];

  const parts = clean.split(".");
  // For hosted subdomains like `sse-account.vercel.app`, format `sse-account` nicely
  const lastTwo = parts.slice(-2).join(".");
  const base =
    parts.length >= 3 && PLATFORM_HOST_SUFFIXES.has(lastTwo)
      ? parts[0]
      : parts[0];

  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function isUrlAllowedForDomain(
  rawUrl: string,
  expectedDomainKey: string
): boolean {
  const target = extractDomainKey(expectedDomainKey);
  const actual = extractDomainKey(rawUrl);
  if (!target || !actual) return false;
  return actual === target;
}

export function getFaviconUrls(domainOrUrl: string): {
  primary: string | null;
  fallback: string | null;
  domain: string;
} {
  const domain = extractDomainKey(domainOrUrl);
  if (!domain || domain === "localhost" || !domain.includes(".")) {
    return { primary: null, fallback: null, domain };
  }
  return {
    domain,
    primary: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    fallback: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
  };
}

export function evaluatePasswordStrength(password: string): {
  score: number; // 0 to 4
  label: "Empty" | "Weak" | "Fair" | "Good" | "Strong";
  color: string;
} {
  if (!password) {
    return { score: 0, label: "Empty", color: "#71717a" };
  }
  let pts = 0;
  if (password.length >= 8) pts += 1;
  if (password.length >= 12) pts += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) pts += 1;
  if (/\d/.test(password)) pts += 1;
  if (/[^a-zA-Z0-9]/.test(password)) pts += 1;

  if (password.length < 6 || pts <= 1) {
    return { score: 1, label: "Weak", color: "#ef4444" };
  }
  if (pts === 2) {
    return { score: 2, label: "Fair", color: "#f59e0b" };
  }
  if (pts === 3 || pts === 4) {
    return { score: 3, label: "Good", color: "#06b6d4" };
  }
  return { score: 4, label: "Strong", color: "#10b981" };
}
