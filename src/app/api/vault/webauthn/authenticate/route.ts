import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getVaultSession } from "@/lib/session";
import { getVaultCollections } from "@/lib/mongodb";
import { applyPinUnlockCookie, sanitizeAutoLockMinutes } from "@/lib/vault-pin";
import {
  WEBAUTHN_CHALLENGE_COOKIE,
  createWebAuthnChallenge,
  getExpectedOriginFromRequest,
  getRpIdFromRequest,
  verifyWebAuthnAssertion,
  type StoredWebAuthnCredential,
} from "@/lib/webauthn";
import {
  decryptCookiePayload,
  encryptCookiePayload,
  getCookieSecurityOptions,
} from "@/lib/auth";
import { logVaultActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const ctx = await getVaultSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_CACHE });
  }

  const { vaultPinConfigs } = await getVaultCollections();
  const doc = await vaultPinConfigs.findOne({ ownerUserId: ctx.userId });
  const creds: StoredWebAuthnCredential[] = Array.isArray(doc?.webauthnCredentials)
    ? (doc.webauthnCredentials as StoredWebAuthnCredential[])
    : [];

  if (creds.length === 0) {
    return NextResponse.json({ available: false, allowCredentialIds: [] }, { headers: NO_CACHE });
  }

  const challenge = createWebAuthnChallenge();
  const rpId = getRpIdFromRequest(req);
  const res = NextResponse.json(
    {
      available: true,
      challenge,
      rpId,
      allowCredentialIds: creds.map((c) => c.credentialId),
    },
    { headers: NO_CACHE }
  );
  res.cookies.set(
    WEBAUTHN_CHALLENGE_COOKIE,
    encryptCookiePayload({ challenge, userId: ctx.userId, at: Date.now() }),
    getCookieSecurityOptions(300)
  );
  return res;
}

const assertSchema = z.object({
  credentialId: z.string().min(8),
  clientDataJSON: z.string().min(10),
  authenticatorData: z.string().min(10),
  signature: z.string().min(10),
});

export async function POST(req: Request) {
  const ctx = await getVaultSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_CACHE });
  }

  const jar = await cookies();
  const rawCh = jar.get(WEBAUTHN_CHALLENGE_COOKIE)?.value;
  const saved = rawCh
    ? decryptCookiePayload<{ challenge: string; userId: string; at: number }>(rawCh)
    : null;
  if (!saved || saved.userId !== ctx.userId || Date.now() - saved.at > 300_000) {
    return NextResponse.json(
      { error: "Biometric challenge expired. Try again." },
      { status: 400, headers: NO_CACHE }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = assertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid biometric assertion." }, { status: 400, headers: NO_CACHE });
  }

  const { vaultPinConfigs } = await getVaultCollections();
  const doc = await vaultPinConfigs.findOne({ ownerUserId: ctx.userId });
  const creds: StoredWebAuthnCredential[] = Array.isArray(doc?.webauthnCredentials)
    ? (doc.webauthnCredentials as StoredWebAuthnCredential[])
    : [];
  const match = creds.find((c) => c.credentialId === parsed.data.credentialId);

  if (!match || !doc) {
    return NextResponse.json({ error: "Unrecognized device passkey." }, { status: 401, headers: NO_CACHE });
  }

  const valid = verifyWebAuthnAssertion({
    credential: match,
    expectedChallenge: saved.challenge,
    expectedOrigin: getExpectedOriginFromRequest(req),
    expectedRpId: getRpIdFromRequest(req),
    clientDataJSONBase64Url: parsed.data.clientDataJSON,
    authenticatorDataBase64Url: parsed.data.authenticatorData,
    signatureBase64Url: parsed.data.signature,
  });

  if (!valid) {
    return NextResponse.json({ error: "Biometric verification failed." }, { status: 401, headers: NO_CACHE });
  }

  const pinVersion = Number(doc.pinVersion || 1);
  const autoLockMinutes = sanitizeAutoLockMinutes(doc.autoLockMinutes ?? 30);

  await logVaultActivity(
    ctx.userId,
    "webauthn_unlock",
    `Unlocked vault with Biometrics / Passkey (${match.label})`
  );

  const res = NextResponse.json(
    {
      ok: true,
      pinStatus: {
        hasPin: true,
        unlocked: true,
        autoLockMinutes,
        failedAttempts: 0,
        lockedUntil: null,
        hasWebAuthn: true,
        webAuthnCount: creds.length,
      },
    },
    { headers: NO_CACHE }
  );
  res.cookies.delete(WEBAUTHN_CHALLENGE_COOKIE);
  applyPinUnlockCookie(res, { userId: ctx.userId, pinVersion, autoLockMinutes });
  return res;
}
