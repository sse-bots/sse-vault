import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  MOBILE_APP_SCHEME,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  decryptCookiePayload,
  encryptCookiePayload,
  getAccountsBaseUrl,
  getAppBaseUrl,
  getCookieSecurityOptions,
  getOAuthClientId,
  getOAuthClientSecret,
  type StoredVaultSession,
} from "@/lib/auth";
import { migrateAndDropBetterAuthCollections } from "@/lib/legacy-auth-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OAuthStatePayload {
  state: string;
  verifier: string;
  nextPath: string;
  mobile?: boolean;
  redirectUri?: string;
  createdAt: number;
}

export async function GET(req: Request) {
  const appBase = getAppBaseUrl();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const fail = (msg: string) => {
    const res = NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(msg)}`, appBase)
    );
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  };

  if (oauthError) {
    return fail(
      searchParams.get("error_description") ||
        `SSE Accounts sign-in cancelled (${oauthError}).`
    );
  }
  if (!code || !state) {
    return fail("Missing authorization code or state from SSE Accounts.");
  }

  const jar = await cookies();
  const rawState = jar.get(OAUTH_STATE_COOKIE)?.value;
  const saved = rawState
    ? decryptCookiePayload<OAuthStatePayload>(rawState)
    : null;

  if (!saved || saved.state !== state) {
    return fail("Sign-in session expired or state mismatch. Please try again.");
  }

  const clientId = getOAuthClientId();
  const clientSecret = getOAuthClientSecret();
  const redirectUri = saved.redirectUri || `${appBase}/api/auth/callback/sse`;
  const accountsBase = getAccountsBaseUrl();

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: saved.verifier,
  });

  const tokenHeaders: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    tokenHeaders.Authorization = `Basic ${basic}`;
  }

  const tokenRes = await fetch(`${accountsBase}/api/auth/oauth2/token`, {
    method: "POST",
    headers: tokenHeaders,
    body: tokenBody.toString(),
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    return fail("Could not exchange SSE Accounts authorization code.");
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!tokenData.access_token) {
    return fail("SSE Accounts did not return an access token.");
  }

  const userRes = await fetch(`${accountsBase}/api/auth/oauth2/userinfo`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!userRes.ok) {
    return fail("Could not load your SSE Accounts profile.");
  }

  const claims = (await userRes.json()) as Record<string, unknown>;
  const sub = String(claims.sub || "").trim();
  if (!sub) return fail("Invalid SSE Accounts user payload.");

  const email =
    typeof claims.email === "string" && claims.email.trim()
      ? claims.email.trim()
      : `${sub}@sse-world.local`;

  // Auto-migrate any legacy Better Auth ownerUserIds to canonical `sub`
  // and delete unneeded Better Auth collections (`user`, `account`, `session`, `verification`).
  try {
    await migrateAndDropBetterAuthCollections({ sub, email });
  } catch (err) {
    console.error("[Auth Callback] Legacy Better Auth cleanup warning:", err);
  }

  const picture =
    typeof claims.picture === "string"
      ? claims.picture
      : typeof claims.image === "string"
        ? claims.image
        : null;

  const sessionPayload: StoredVaultSession = {
    user: {
      sub,
      name: String(
        claims.name || claims.preferred_username || claims.username || email
      ),
      username: typeof claims.username === "string" ? claims.username : null,
      email,
      image: picture,
      discordId:
        typeof claims.discord_id === "string" ? claims.discord_id : null,
      sseRole: typeof claims.sse_role === "string" ? claims.sse_role : "member",
    },
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
  };

  const target =
    saved.nextPath &&
    saved.nextPath.startsWith("/") &&
    !saved.nextPath.startsWith("//")
      ? saved.nextPath
      : "/vault";

  if (saved.mobile) {
    // Native app sign-in: hand the encrypted session to the app via deep link.
    const token = encryptCookiePayload(sessionPayload);
    const back = new Response(null, {
      status: 302,
      headers: {
        Location: `${MOBILE_APP_SCHEME}://auth?token=${encodeURIComponent(token)}`,
        "Cache-Control": "no-store",
        "Set-Cookie": `${OAUTH_STATE_COOKIE}=; Path=/; Max-Age=0`,
      },
    });
    return back;
  }

  const res = NextResponse.redirect(new URL(target, appBase));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.set(
    SESSION_COOKIE,
    encryptCookiePayload(sessionPayload),
    getCookieSecurityOptions(60 * 60 * 24 * 30)
  );
  return res;
}
