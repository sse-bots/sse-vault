import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  createPkcePair,
  encryptCookiePayload,
  getAccountsBaseUrl,
  getAppBaseUrl,
  getCookieSecurityOptions,
  getOAuthClientId,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawNext = searchParams.get("next") || "/vault";
  const mobile = searchParams.get("mobile") === "1";
  const pinReset = searchParams.get("pin_reset") === "1";
  const nextPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/vault";

  const clientId = getOAuthClientId();
  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=${encodeURIComponent(
          "SSE_CLIENT_ID is not configured in environment variables."
        )}`,
        getAppBaseUrl()
      )
    );
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const { verifier, challenge } = createPkcePair();
  const redirectUri = `${getAppBaseUrl()}/api/auth/callback/sse`;

  const authUrl = new URL(`${getAccountsBaseUrl()}/api/auth/oauth2/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "openid profile email offline_access");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const payload = encryptCookiePayload({
    state,
    verifier,
    nextPath,
    mobile,
    pinReset,
    redirectUri,
    createdAt: Date.now(),
  });

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set(OAUTH_STATE_COOKIE, payload, getCookieSecurityOptions(600));
  return res;
}
