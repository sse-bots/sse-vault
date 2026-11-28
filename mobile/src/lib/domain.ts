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
  "co.id"
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
  "secure-note.local": "Secure Notes",
  "payment-cards.local": "Payment Cards",
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
  "codesandbox.io": "CodeSandbox",
  "replit.com": "Replit",
  "codepen.io": "CodePen",
  "glitch.com": "Glitch",
  "stackoverflow.com": "Stack Overflow",
  "huggingface.co": "Hugging Face",
  "postman.com": "Postman",
  "linear.app": "Linear",
  "sentry.io": "Sentry",
  "uptimerobot.com": "UptimeRobot",
  "leetcode.com": "LeetCode",
  "hackerrank.com": "HackerRank",
  "railway.app": "Railway",
  "fly.dev": "Fly.io",
  "aws.amazon.com": "AWS",
  "azure.com": "Microsoft Azure",
  "slack.com": "Slack",
  "zoom.us": "Zoom",
  "trello.com": "Trello",
  "asana.com": "Asana",
  "atlassian.com": "Atlassian",
  "canva.com": "Canva",
  "dropbox.com": "Dropbox",
  "razorpay.com": "Razorpay",
  "paytm.com": "Paytm",
  "phonepe.com": "PhonePe",
  "groww.in": "Groww",
  "zerodha.com": "Zerodha",
  "upstox.com": "Upstox",
  "binance.com": "Binance",
  "coinbase.com": "Coinbase",
  "roblox.com": "Roblox",
  "plarium.com": "Plarium",
  "riotgames.com": "Riot Games",
  "supercell.com": "Supercell",
  "garena.com": "Garena",
  "flipkart.com": "Flipkart",
  "swiggy.com": "Swiggy",
  "zomato.com": "Zomato",
  "irctc.co.in": "IRCTC",
  "threads.net": "Threads",
  "snapchat.com": "Snapchat",
  "pinterest.com": "Pinterest",
  "tiktok.com": "TikTok",
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

export type AutoDetectedCategory =
  | "personal"
  | "work"
  | "dev"
  | "gaming"
  | "finance"
  | "social"
  | "other";

const CATEGORY_DOMAIN_MAP: Record<string, AutoDetectedCategory> = {
  // Developer
  "github.com": "dev",
  "gitlab.com": "dev",
  "bitbucket.org": "dev",
  "codesandbox.io": "dev",
  "replit.com": "dev",
  "codepen.io": "dev",
  "glitch.com": "dev",
  "vercel.com": "dev",
  "vercel.app": "dev",
  "netlify.com": "dev",
  "netlify.app": "dev",
  "render.com": "dev",
  "onrender.com": "dev",
  "mongodb.com": "dev",
  "supabase.com": "dev",
  "firebase.google.com": "dev",
  "cloudflare.com": "dev",
  "npmjs.com": "dev",
  "docker.com": "dev",
  "heroku.com": "dev",
  "digitalocean.com": "dev",
  "railway.app": "dev",
  "fly.dev": "dev",
  "hostinger.com": "dev",
  "godaddy.com": "dev",
  "namecheap.com": "dev",
  "resend.com": "dev",
  "openai.com": "dev",
  "chatgpt.com": "dev",
  "anthropic.com": "dev",
  "claude.ai": "dev",
  "figma.com": "dev",
  "stackoverflow.com": "dev",
  "huggingface.co": "dev",
  "postman.com": "dev",
  "linear.app": "dev",
  "sentry.io": "dev",
  "uptimerobot.com": "dev",
  "leetcode.com": "dev",
  "hackerrank.com": "dev",
  "aws.amazon.com": "dev",
  "azure.com": "dev",
  "cloud.google.com": "dev",
  "kaggle.com": "dev",
  "npmjs.org": "dev",
  "pypi.org": "dev",
  "expo.dev": "dev",
  "ngrok.com": "dev",
  "tailscale.com": "dev",
  "linode.com": "dev",
  "vultr.com": "dev",
  "hetzner.com": "dev",
  "porkbun.com": "dev",
  "cloudflare.dev": "dev",

  // Gaming
  "discord.com": "gaming",
  "steam.com": "gaming",
  "steampowered.com": "gaming",
  "epicgames.com": "gaming",
  "minecraft.net": "gaming",
  "mojang.com": "gaming",
  "twitch.tv": "gaming",
  "roblox.com": "gaming",
  "plarium.com": "gaming",
  "riotgames.com": "gaming",
  "supercell.com": "gaming",
  "garena.com": "gaming",
  "ea.com": "gaming",
  "ubisoft.com": "gaming",
  "playstation.com": "gaming",
  "xbox.com": "gaming",
  "nintendo.com": "gaming",
  "rockstargames.com": "gaming",
  "battle.net": "gaming",
  "curseforge.com": "gaming",
  "modrinth.com": "gaming",
  "aternos.org": "gaming",

  // Finance
  "paypal.com": "finance",
  "stripe.com": "finance",
  "razorpay.com": "finance",
  "paytm.com": "finance",
  "phonepe.com": "finance",
  "groww.in": "finance",
  "zerodha.com": "finance",
  "upstox.com": "finance",
  "binance.com": "finance",
  "coinbase.com": "finance",
  "wise.com": "finance",
  "sbi.co.in": "finance",
  "onlinesbi.sbi": "finance",
  "hdfcbank.com": "finance",
  "icicibank.com": "finance",
  "axisbank.com": "finance",
  "kotak.com": "finance",
  "payment-cards.local": "finance",

  // Social
  "instagram.com": "social",
  "facebook.com": "social",
  "x.com": "social",
  "reddit.com": "social",
  "whatsapp.com": "social",
  "telegram.org": "social",
  "linkedin.com": "social",
  "snapchat.com": "social",
  "threads.net": "social",
  "pinterest.com": "social",
  "tiktok.com": "social",
  "youtube.com": "social",
  "quora.com": "social",
  "medium.com": "social",

  // Work
  "notion.so": "work",
  "slack.com": "work",
  "zoom.us": "work",
  "trello.com": "work",
  "asana.com": "work",
  "atlassian.com": "work",
  "jira.com": "work",
  "canva.com": "work",
  "dropbox.com": "work",
  "miro.com": "work",
  "airtable.com": "work",
  "clickup.com": "work",
  "monday.com": "work",
  "calendly.com": "work",

  // Personal
  "google.com": "personal",
  "apple.com": "personal",
  "icloud.com": "personal",
  "microsoft.com": "personal",
  "proton.me": "personal",
  "protonmail.com": "personal",
  "amazon.com": "personal",
  "amazon.in": "personal",
  "flipkart.com": "personal",
  "spotify.com": "personal",
  "netflix.com": "personal",
  "swiggy.com": "personal",
  "zomato.com": "personal",
  "irctc.co.in": "personal",
  "bitwarden.com": "personal",
  "sse-account.vercel.app": "personal",
  "secure-note.local": "personal",
};

/**
 * Automatically categorizes a website/app into `dev`, `gaming`, `finance`,
 * `social`, `work`, or `personal` using exact domain lookup + smart suffixes/keywords.
 */
export function detectVaultCategory(
  domainOrUrl: string,
  appName?: string | null,
  label?: string | null,
  entryType?: "login" | "note" | "card"
): AutoDetectedCategory {
  if (entryType === "card") return "finance";
  if (entryType === "note") return "personal";

  const domain = extractDomainKey(domainOrUrl) || (domainOrUrl || "").trim().toLowerCase();
  if (domain && CATEGORY_DOMAIN_MAP[domain]) {
    return CATEGORY_DOMAIN_MAP[domain];
  }

  // Platform hosting domains (*.vercel.app, *.onrender.com, *.netlify.app, etc.)
  if (domain) {
    if (
      domain.endsWith(".vercel.app") ||
      domain.endsWith(".netlify.app") ||
      domain.endsWith(".onrender.com") ||
      domain.endsWith(".pages.dev") ||
      domain.endsWith(".railway.app") ||
      domain.endsWith(".fly.dev") ||
      domain.endsWith(".herokuapp.com") ||
      domain.endsWith(".github.io") ||
      domain.endsWith(".dev")
    ) {
      if (domain === "sse-account.vercel.app") return "personal";
      return "dev";
    }
  }

  const hay = `${domain} ${appName || ""} ${label || ""}`.toLowerCase();

  if (
    /\b(github|gitlab|codesandbox|replit|codepen|vercel|netlify|render|mongo|supabase|firebase|docker|cloud|aws|azure|hostinger|vps|pterodactyl|api|console|developer|dev|coding|code|npm|pypi|stack|expo|bot|server|ssh|git|database|db|hosting)\b/.test(
      hay
    )
  ) {
    return "dev";
  }

  if (
    /\b(game|gaming|steam|epic|minecraft|discord|twitch|roblox|plarium|mech|free\s*fire|garena|riot|valorant|supercell|playstation|xbox|nintendo|esports|tournament)\b/.test(
      hay
    )
  ) {
    return "gaming";
  }

  if (
    /\b(bank|upi|pay|wallet|stripe|razorpay|paypal|paytm|phonepe|finance|invest|zerodha|groww|upstox|crypto|binance|coinbase|trading|demat|card|loan|tax|gst|insurance)\b/.test(
      hay
    )
  ) {
    return "finance";
  }

  if (
    /\b(insta|facebook|twitter|reddit|whatsapp|telegram|linkedin|snapchat|threads|tiktok|pinterest|social|youtube)\b/.test(
      hay
    )
  ) {
    return "social";
  }

  if (
    /\b(slack|zoom|notion|jira|trello|asana|atlassian|office|workspace|canva|dropbox|teams|meeting|work|company|corp|hr)\b/.test(
      hay
    )
  ) {
    return "work";
  }

  return "personal";
}

export const DEFAULT_SECURITY_QUESTIONS: string[] = [
  "What city were you born in?",
  "What is the name of your first school?",
  "What is your favourite game or movie?",
  "What was your childhood nickname?",
  "What is the name of your first pet?",
  "What is your mother's maiden name?",
  "What is the name of your favourite teacher?",
  "What street did you grow up on?",
];
