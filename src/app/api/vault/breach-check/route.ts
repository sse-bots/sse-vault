import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import { serializeVaultDoc } from "@/lib/vault-serializer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const { vaultItems } = await getVaultCollections();
  const docs = await vaultItems
    .find({
      ownerUserId: ctx.userId,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
    .toArray();

  const items = docs.map(serializeVaultDoc);
  const passwordEntries = items.filter(
    (i) => i.entryType === "login" && i.authType === "password" && i.password
  );

  const prefixMap = new Map<string, Array<{ id: string; suffix: string }>>();
  for (const item of passwordEntries) {
    const sha1 = crypto
      .createHash("sha1")
      .update(item.password!, "utf8")
      .digest("hex")
      .toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const bucket = prefixMap.get(prefix) || [];
    bucket.push({ id: item.id, suffix });
    prefixMap.set(prefix, bucket);
  }

  const compromised: Array<{ id: string; count: number }> = [];
  const prefixes = Array.from(prefixMap.entries());

  for (let i = 0; i < prefixes.length; i += 8) {
    const batch = prefixes.slice(i, i + 8);
    await Promise.all(
      batch.map(async ([prefix, entries]) => {
        try {
          const res = await fetch(
            `https://api.pwnedpasswords.com/range/${prefix}`,
            {
              headers: {
                "Add-Padding": "true",
                "User-Agent": "SSE-Vault-BreachCheck",
              },
              cache: "no-store",
            }
          );
          if (!res.ok) return;
          const text = await res.text();
          const counts = new Map<string, number>();
          for (const line of text.split(/\r?\n/)) {
            const [suf, cnt] = line.split(":");
            if (suf && cnt) {
              const n = Number.parseInt(cnt.trim(), 10);
              if (n > 0) counts.set(suf.trim().toUpperCase(), n);
            }
          }
          for (const e of entries) {
            const hits = counts.get(e.suffix);
            if (hits && hits > 0) compromised.push({ id: e.id, count: hits });
          }
        } catch {
          /* skip timeout */
        }
      })
    );
  }

  return NextResponse.json(
    {
      ok: true,
      checkedCount: passwordEntries.length,
      compromised,
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
