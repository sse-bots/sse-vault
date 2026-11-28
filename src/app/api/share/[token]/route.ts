import crypto from "crypto";
import { NextResponse } from "next/server";
import { getVaultCollections } from "@/lib/mongodb";
import { decryptSecretWithKey } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ exists: false }, { status: 404, headers: NO_CACHE });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const { vaultShares } = await getVaultCollections();
  const doc = await vaultShares.findOne({ tokenHash });

  if (!doc || new Date(doc.expiresAt as string | Date).getTime() <= Date.now()) {
    if (doc) await vaultShares.deleteOne({ _id: doc._id }).catch(() => {});
    return NextResponse.json(
      { exists: false, error: "This secret link has expired or was already viewed." },
      { status: 404, headers: NO_CACHE }
    );
  }

  return NextResponse.json(
    {
      exists: true,
      title: String(doc.title || "Shared Secret"),
      expiresAt: new Date(doc.expiresAt as string | Date).toISOString(),
    },
    { headers: NO_CACHE }
  );
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid link." }, { status: 404, headers: NO_CACHE });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const { vaultShares } = await getVaultCollections();
  const doc = await vaultShares.findOneAndDelete({ tokenHash });

  if (!doc || new Date(doc.expiresAt as string | Date).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "This one-time secret has expired or was already viewed." },
      { status: 404, headers: NO_CACHE }
    );
  }

  const keyHex = crypto
    .createHash("sha256")
    .update(`share:${token}`)
    .digest("hex");
  const plain = decryptSecretWithKey(String(doc.encryptedPayload || ""), keyHex);
  if (!plain) {
    return NextResponse.json(
      { error: "Could not decrypt shared secret." },
      { status: 500, headers: NO_CACHE }
    );
  }

  return NextResponse.json({ ok: true, secret: JSON.parse(plain) }, { headers: NO_CACHE });
}
