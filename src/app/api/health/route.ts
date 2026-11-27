import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getAccountsBaseUrl, getOAuthClientId, getOAuthClientSecret } from "@/lib/auth";
import { getKeyFingerprint, shouldStoreHexcodeInDb } from "@/lib/crypto";
import { getLegacyBetterAuthCollectionsStatus } from "@/lib/legacy-auth-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  let dbError: string | null = null;
  let legacyAuth: { hasLegacyCollections: boolean; collections: string[] } = {
    hasLegacyCollections: false,
    collections: [],
  };

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    dbOk = true;
    legacyAuth = await getLegacyBetterAuthCollectionsStatus();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "MongoDB connection failed";
  }

  return NextResponse.json(
    {
      ok: dbOk,
      database: dbOk ? "connected" : "error",
      dbError,
      authMode: "stateless-oauth2-pkce-cookie",
      legacyBetterAuthCollections: legacyAuth.collections,
      ssoIssuer: getAccountsBaseUrl(),
      encryption: {
        activeKeyFingerprint: getKeyFingerprint(),
        storesHexcodeFallbackInDb: shouldStoreHexcodeInDb(),
        hasLegacyEnvSecrets: Boolean(
          (process.env.VAULT_LEGACY_ENCRYPTION_SECRETS || "").trim()
        ),
      },
      config: {
        hasAppUrl: Boolean(
          process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL
        ),
        hasSessionSecret: Boolean(
          process.env.SESSION_SECRET || process.env.BETTER_AUTH_SECRET
        ),
        hasVaultEncryptionSecret: Boolean(process.env.VAULT_ENCRYPTION_SECRET),
        hasMongoUri: Boolean(process.env.MONGODB_URI),
        hasSseClientId: Boolean(getOAuthClientId()),
        hasSseClientSecret: Boolean(getOAuthClientSecret()),
      },
    },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
