import crypto from "crypto";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import { encryptSecretWithKey } from "@/lib/crypto";
import { serializeVaultDoc } from "@/lib/vault-serializer";
import { getAppBaseUrl } from "@/lib/auth";
import { logVaultActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const shareSchema = z.object({
  itemId: z.string().min(1),
  expiresMinutes: z.enum(["10", "60", "1440"]).optional().default("60"),
});

export async function POST(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const body = await req.json().catch(() => null);
  const parsed = shareSchema.safeParse(body);
  if (!parsed.success || !ObjectId.isValid(parsed.data.itemId)) {
    return NextResponse.json({ error: "Invalid share request." }, { status: 400 });
  }

  const { vaultItems, vaultShares } = await getVaultCollections();
  const doc = await vaultItems.findOne({
    _id: new ObjectId(parsed.data.itemId),
    ownerUserId: ctx.userId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });
  if (!doc) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const item = serializeVaultDoc(doc);
  const mins = Number(parsed.data.expiresMinutes);
  const expiresAt = new Date(Date.now() + mins * 60 * 1000);

  const rawToken = crypto.randomBytes(24).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const keyHex = crypto
    .createHash("sha256")
    .update(`share:${rawToken}`)
    .digest("hex");

  const sharePayload = {
    appName: item.appName,
    label: item.label,
    url: item.url,
    entryType: item.entryType,
    authType: item.authType,
    oauthProvider: item.oauthProvider,
    email: item.email,
    username: item.username,
    password: item.password,
    cardDetails: item.cardDetails,
    customFields: item.customFields,
    notes: item.notes,
  };

  await vaultShares.insertOne({
    tokenHash,
    ownerUserId: ctx.userId,
    title: item.label || item.appName,
    encryptedPayload: encryptSecretWithKey(JSON.stringify(sharePayload), keyHex),
    expiresAt,
    createdAt: new Date(),
  });

  await vaultShares.deleteMany({ expiresAt: { $lte: new Date() } }).catch(() => {});
  await logVaultActivity(
    ctx.userId,
    "share_created",
    `Created one-time share link for ${item.label || item.appName} (${mins}m)`
  );

  return NextResponse.json(
    { ok: true, url: `${getAppBaseUrl()}/share/${rawToken}`, expiresAt: expiresAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
