import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { genericOAuth } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { mongoClient, getDbSync } from "./mongodb";
import { getSseIssuerUrl } from "./sse-sso";

function normalizeOrigin(url?: string | null): string | null {
  const cleaned = (url || "").trim().replace(/\/+$/, "");
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) {
    return `https://${cleaned}`;
  }
  return cleaned;
}

const appUrl =
  normalizeOrigin(process.env.BETTER_AUTH_URL) ||
  normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
  normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
  normalizeOrigin(process.env.VERCEL_URL) ||
  "http://localhost:3000";

const sseIssuerUrl = getSseIssuerUrl();
const isHttps = appUrl.startsWith("https://");

const extraTrustedOrigins = (process.env.TRUSTED_ORIGINS || "")
  .split(",")
  .map((o) => normalizeOrigin(o))
  .filter((o): o is string => Boolean(o));

const trustedOrigins = Array.from(
  new Set(
    [
      appUrl,
      sseIssuerUrl,
      normalizeOrigin(process.env.BETTER_AUTH_URL),
      normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL),
      normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
      normalizeOrigin(process.env.VERCEL_URL),
      ...extraTrustedOrigins,
      ...(process.env.NODE_ENV !== "production"
        ? ["http://localhost:3000", "http://127.0.0.1:3000"]
        : []),
    ].filter((o): o is string => Boolean(o))
  )
);

export const auth = betterAuth({
  appName: "SSE Vault",
  baseURL: appUrl,
  trustedOrigins,
  secret:
    (process.env.BETTER_AUTH_SECRET || "").trim() ||
    "build-placeholder-secret-change-me",
  database: mongodbAdapter(getDbSync(), {
    client: mongoClient,
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: false,
    },
  },
  advanced: {
    useSecureCookies: isHttps,
    defaultCookieAttributes: {
      sameSite: "lax",
      httpOnly: true,
      secure: isHttps,
      path: "/",
    },
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      discordId: { type: "string", required: false, input: false },
      sseRole: { type: "string", required: false, input: false },
    },
  },
  account: {
    updateAccountOnSignIn: true,
    accountLinking: {
      enabled: true,
      trustedProviders: ["sse"],
      allowDifferentEmails: true,
    },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "sse",
          clientId: (process.env.SSE_CLIENT_ID || "").trim(),
          clientSecret: (process.env.SSE_CLIENT_SECRET || "").trim(),
          authentication: "basic",
          discoveryUrl: `${sseIssuerUrl}/.well-known/openid-configuration`,
          authorizationUrl: `${sseIssuerUrl}/api/auth/oauth2/authorize`,
          tokenUrl: `${sseIssuerUrl}/api/auth/oauth2/token`,
          userInfoUrl: `${sseIssuerUrl}/api/auth/oauth2/userinfo`,
          scopes: ["openid", "profile", "email", "offline_access"],
          pkce: true,
          disableProviderLogout: true,
          mapProfileToUser: (profile) => {
            const p = profile as Record<string, unknown>;
            const picture =
              typeof p.picture === "string"
                ? p.picture
                : typeof p.image === "string"
                  ? p.image
                  : undefined;
            return {
              name: String(
                p.name || p.preferred_username || p.email || "SSE User"
              ),
              email: String(
                p.email || `${String(p.sub || "user")}@sse-world.local`
              ),
              image: picture,
              username:
                typeof p.username === "string" ? p.username : undefined,
              discordId:
                typeof p.discord_id === "string" ? p.discord_id : undefined,
              sseRole:
                typeof p.sse_role === "string" ? p.sse_role : "member",
            };
          },
        },
      ],
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
