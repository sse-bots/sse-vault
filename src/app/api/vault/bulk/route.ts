import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("trash"),
    ids: z.array(z.string()).min(1).max(200),
  }),
  z.object({
    action: z.literal("category"),
    ids: z.array(z.string()).min(1).max(200),
    category: z.enum([
      "personal",
      "work",
      "dev",
      "gaming",
      "finance",
      "social",
      "other",
    ]),
  }),
]);

export async function POST(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const body = await req.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bulk request." }, { status: 400 });
  }

  const oids = parsed.data.ids
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (oids.length === 0) {
    return NextResponse.json({ error: "No valid entry IDs selected." }, { status: 400 });
  }

  const { vaultItems } = await getVaultCollections();
  if (parsed.data.action === "trash") {
    const res = await vaultItems.updateMany(
      { _id: { $in: oids }, ownerUserId: ctx.userId },
      { $set: { deletedAt: new Date(), updatedAt: new Date() } }
    );
    return NextResponse.json({ ok: true, updatedCount: res.modifiedCount });
  }

  const res = await vaultItems.updateMany(
    { _id: { $in: oids }, ownerUserId: ctx.userId },
    { $set: { category: parsed.data.category, updatedAt: new Date() } }
  );
  return NextResponse.json({ ok: true, updatedCount: res.modifiedCount });
}
