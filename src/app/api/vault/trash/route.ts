import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import { serializeVaultDoc } from "@/lib/vault-serializer";
import { logVaultActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const trashActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("restore"), id: z.string().min(1) }),
  z.object({ action: z.literal("delete"), id: z.string().min(1) }),
  z.object({ action: z.literal("empty") }),
]);

export async function GET() {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const { vaultItems } = await getVaultCollections();
  const cutoff = new Date(Date.now() - TRASH_TTL_MS);
  await vaultItems
    .deleteMany({ ownerUserId: ctx.userId, deletedAt: { $lte: cutoff } })
    .catch(() => {});

  const docs = await vaultItems
    .find({ ownerUserId: ctx.userId, deletedAt: { $ne: null } })
    .sort({ deletedAt: -1 })
    .toArray();

  const items = docs.map((doc) => {
    const dto = serializeVaultDoc(doc);
    const deletedMs = doc.deletedAt
      ? new Date(doc.deletedAt as string | Date).getTime()
      : Date.now();
    const msLeft = Math.max(0, deletedMs + TRASH_TTL_MS - Date.now());
    const daysRemaining = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
    return { ...dto, daysRemaining };
  });

  return NextResponse.json({ items }, { headers: NO_CACHE });
}

export async function POST(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const body = await req.json().catch(() => null);
  const parsed = trashActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid trash action." },
      { status: 400, headers: NO_CACHE }
    );
  }

  const { vaultItems } = await getVaultCollections();
  const d = parsed.data;

  if (d.action === "empty") {
    const res = await vaultItems.deleteMany({
      ownerUserId: ctx.userId,
      deletedAt: { $ne: null },
    });
    await logVaultActivity(
      ctx.userId,
      "trash_empty",
      `Permanently deleted ${res.deletedCount} trashed item(s)`
    );
    return NextResponse.json(
      { ok: true, deletedCount: res.deletedCount },
      { headers: NO_CACHE }
    );
  }

  if (!ObjectId.isValid(d.id)) {
    return NextResponse.json(
      { error: "Invalid entry ID." },
      { status: 400, headers: NO_CACHE }
    );
  }
  const oid = new ObjectId(d.id);

  if (d.action === "restore") {
    const res = await vaultItems.updateOne(
      { _id: oid, ownerUserId: ctx.userId },
      { $set: { deletedAt: null, updatedAt: new Date() } }
    );
    if (res.matchedCount === 0) {
      return NextResponse.json(
        { error: "Trashed entry not found." },
        { status: 404, headers: NO_CACHE }
      );
    }
    const restored = await vaultItems.findOne({ _id: oid });
    return NextResponse.json(
      { ok: true, item: restored ? serializeVaultDoc(restored) : null },
      { headers: NO_CACHE }
    );
  }

  const res = await vaultItems.deleteOne({
    _id: oid,
    ownerUserId: ctx.userId,
    deletedAt: { $ne: null },
  });
  return NextResponse.json(
    { ok: true, deletedCount: res.deletedCount },
    { headers: NO_CACHE }
  );
}
