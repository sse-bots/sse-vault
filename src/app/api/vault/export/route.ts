import { NextResponse } from "next/server";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import { serializeVaultDoc } from "@/lib/vault-serializer";
import { serializeVaultItemsToCsv } from "@/lib/import-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "json").toLowerCase();

  const { vaultItems } = await getVaultCollections();
  const docs = await vaultItems
    .find({ ownerUserId: ctx.userId })
    .sort({ domainKey: 1, updatedAt: -1 })
    .toArray();

  const serialized = docs.map(serializeVaultDoc);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const csv = serializeVaultItemsToCsv(serialized);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sse-vault-passwords-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    owner: { name: ctx.name, email: ctx.email },
    totalEntries: serialized.length,
    entries: serialized,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sse-vault-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
