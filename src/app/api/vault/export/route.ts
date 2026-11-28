import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import { serializeVaultDoc } from "@/lib/vault-serializer";
import { serializeVaultItemsToCsv } from "@/lib/import-parser";
import { encryptVaultBackup } from "@/lib/backup-crypto";
import { logVaultActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadExportEntries(ownerUserId: string, rawIds?: string[]) {
  const { vaultItems } = await getVaultCollections();
  const filter: Record<string, unknown> = {
    ownerUserId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };
  if (rawIds && rawIds.length > 0) {
    const oids = rawIds
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    if (oids.length > 0) filter._id = { $in: oids };
  }
  const docs = await vaultItems
    .find(filter)
    .sort({ domainKey: 1, updatedAt: -1 })
    .toArray();
  return docs.map(serializeVaultDoc);
}

export async function GET(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "json").toLowerCase();
  const idsParam = (searchParams.get("ids") || "").trim();
  const ids = idsParam ? idsParam.split(",").filter(Boolean) : undefined;

  const serialized = await loadExportEntries(ctx.userId, ids);
  const stamp = new Date().toISOString().slice(0, 10);

  await logVaultActivity(
    ctx.userId,
    "export",
    `Exported ${serialized.length} item(s) as ${format.toUpperCase()}`
  );

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

const encryptedExportSchema = z.object({
  passphrase: z.string().min(6, "Passphrase must be at least 6 characters.").max(200),
  ids: z.array(z.string()).max(500).optional(),
});

export async function POST(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const body = await req.json().catch(() => null);
  const parsed = encryptedExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid passphrase." },
      { status: 400 }
    );
  }

  const serialized = await loadExportEntries(ctx.userId, parsed.data.ids);
  const stamp = new Date().toISOString().slice(0, 10);
  const plaintext = JSON.stringify({
    exportedAt: new Date().toISOString(),
    owner: { name: ctx.name, email: ctx.email },
    totalEntries: serialized.length,
    entries: serialized,
  });

  const envelope = encryptVaultBackup(plaintext, parsed.data.passphrase);

  await logVaultActivity(
    ctx.userId,
    "export",
    `Exported ${serialized.length} item(s) as encrypted .ssevault backup`
  );

  return new NextResponse(JSON.stringify(envelope, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sse-vault-encrypted-${stamp}.ssevault"`,
      "Cache-Control": "no-store",
    },
  });
}
