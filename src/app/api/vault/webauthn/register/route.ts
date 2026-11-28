import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import {
  WEBAUTHN_CHALLENGE_COOKIE,
  createWebAuthnChallenge,
  getRpIdFromRequest,
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
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const challenge = createWebAuthnChallenge();
  const rpId = getRpIdFromRequest(req);

  const { vaultPinConfigs } = await getVaultCollections();
  const doc = await vaultPinConfigs.findOne({ ownerUserId: ctx.userId });
  const existingCreds: StoredWebAuthnCredential[] = Array.isArray(
    doc?.webauthnCredentials
  )
    ? (doc.webauthnCredentials as StoredWebAuthnCredential[])
    : [];

  const res = NextResponse.json(
    {
      challenge,
      rpId,
      rpName: "SSE Vault",
      user: {
        id: Buffer.from(ctx.userId, "utf8").toString("base64url"),
        name: ctx.email || ctx.userId,
        displayName: ctx.name || "SSE User",
      },
      excludeCredentialIds: existingCreds.map((c) => c.credentialId),
      credentials: existingCreds.map((c) => ({
        credentialId: c.credentialId,
        label: c.label,
        createdAt: c.createdAt,
      })),
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

const registerSchema = z.object({
  credentialId: z.string().min(8).max(512),
  publicKeySpkiBase64: z.string().min(16).max(4096),
  algorithm: z.number().int(),
  label: z.string().trim().max(80).optional().default("This Device"),
});

export async function POST(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const jar = await cookies();
  const rawCh = jar.get(WEBAUTHN_CHALLENGE_COOKIE)?.value;
  const saved = rawCh
    ? decryptCookiePayload<{ challenge: string; userId: string; at: number }>(rawCh)
    : null;
  if (!saved || saved.userId !== ctx.userId || Date.now() - saved.at > 300_000) {
    return NextResponse.json(
      { error: "Biometric registration session expired. Try again." },
      { status: 400, headers: NO_CACHE }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid passkey registration payload." },
      { status: 400, headers: NO_CACHE }
    );
  }

  const { vaultPinConfigs } = await getVaultCollections();
  const doc = await vaultPinConfigs.findOne({ ownerUserId: ctx.userId });
  const prev: StoredWebAuthnCredential[] = Array.isArray(doc?.webauthnCredentials)
    ? (doc.webauthnCredentials as StoredWebAuthnCredential[])
    : [];

  const nextCred: StoredWebAuthnCredential = {
    credentialId: parsed.data.credentialId,
    publicKeySpkiBase64: parsed.data.publicKeySpkiBase64,
    algorithm: parsed.data.algorithm,
    label: parsed.data.label || "This Device",
    createdAt: new Date().toISOString(),
  };

  const merged = [
    ...prev.filter((c) => c.credentialId !== nextCred.credentialId),
    nextCred,
  ].slice(-8);

  await vaultPinConfigs.updateOne(
    { ownerUserId: ctx.userId },
    { $set: { webauthnCredentials: merged, updatedAt: new Date() } }
  );

  await logVaultActivity(
    ctx.userId,
    "webauthn_register",
    `Enabled Web Biometric / Passkey unlock (${nextCred.label})`
  );

  const res = NextResponse.json({ ok: true, count: merged.length }, { headers: NO_CACHE });
  res.cookies.delete(WEBAUTHN_CHALLENGE_COOKIE);
  return res;
}

export async function DELETE(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const { searchParams } = new URL(req.url);
  const credId = searchParams.get("credentialId");
  const { vaultPinConfigs } = await getVaultCollections();

  if (credId) {
    const doc = await vaultPinConfigs.findOne({ ownerUserId: ctx.userId });
    const prev: StoredWebAuthnCredential[] = Array.isArray(doc?.webauthnCredentials)
      ? (doc.webauthnCredentials as StoredWebAuthnCredential[])
      : [];
    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      {
        $set: {
          webauthnCredentials: prev.filter((c) => c.credentialId !== credId),
          updatedAt: new Date(),
        },
      }
    );
  } else {
    await vaultPinConfigs.updateOne(
      { ownerUserId: ctx.userId },
      { $set: { webauthnCredentials: [], updatedAt: new Date() } }
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_CACHE });
}
