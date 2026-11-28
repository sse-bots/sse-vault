import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import { detectVaultCategory } from "@/lib/domain";
import { logVaultActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  forceAll: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const forceAll = parsed.success ? parsed.data.forceAll : true;

  const { vaultItems, vaultPinConfigs } = await getVaultCollections();
  const docs = await vaultItems
    .find({
      ownerUserId: ctx.userId,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
    .toArray();

  let updatedCount = 0;
  for (const doc of docs) {
    const currentCat = String(doc.category || "personal");
    const entryType =
      doc.entryType === "note" || doc.entryType === "card"
        ? doc.entryType
        : "login";
    const detected = detectVaultCategory(
      String(doc.domainKey || doc.url || ""),
      typeof doc.appName === "string" ? doc.appName : "",
      typeof doc.label === "string" ? doc.label : "",
      entryType
    );

    const shouldUpdate = forceAll
      ? detected !== currentCat
      : (currentCat === "personal" || currentCat === "other") &&
        detected !== currentCat;

    if (shouldUpdate) {
      await vaultItems.updateOne(
        { _id: doc._id },
        { $set: { category: detected, updatedAt: new Date() } }
      );
      updatedCount += 1;
    }
  }

  await vaultPinConfigs
    .updateOne(
      { ownerUserId: ctx.userId },
      { $set: { autoCategorizedVersion: 1, updatedAt: new Date() } }
    )
    .catch(() => {});

  if (updatedCount > 0) {
    await logVaultActivity(
      ctx.userId,
      "auto_categorize",
      `Auto-categorized ${updatedCount} of ${docs.length} vault item(s)`
    );
  }

  return NextResponse.json(
    { ok: true, scannedCount: docs.length, updatedCount },
    { headers: { "Cache-Control": "no-store" } }
  );
}
