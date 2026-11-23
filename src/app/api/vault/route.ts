import { NextResponse } from "next/server";
import { z } from "zod";
import { getVaultSession } from "@/lib/session";
import { getVaultCollections } from "@/lib/mongodb";
import { encryptSecret, generateCodeId } from "@/lib/crypto";
import { inferLabelFromUrl, normalizeDisplayUrl } from "@/lib/parse-codes";
import { serializeVaultDoc } from "@/lib/vault-serializer";
import type { StoredSecurityCode } from "@/lib/vault-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };

const createItemSchema = z.object({
  label: z.string().trim().max(80).optional().default(""),
  url: z.string().trim().min(1, "Website URL is required.").max(300),
  email: z.string().trim().max(160).optional().default(""),
  username: z.string().trim().max(120).optional().default(""),
  password: z.string().max(512).optional().default(""),
  totpSecret: z.string().trim().max(512).optional().default(""),
  securityCodes: z
    .array(z.string().trim().min(1).max(128))
    .max(100)
    .optional()
    .default([]),
  notes: z.string().trim().max(1000).optional().default(""),
  favorite: z.boolean().optional().default(false),
});

export async function GET() {
  const ctx = await getVaultSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultItems } = await getVaultCollections();
  const docs = await vaultItems
    .find({ ownerUserId: ctx.userId })
    .sort({ favorite: -1, updatedAt: -1 })
    .toArray();

  return NextResponse.json(
    { items: docs.map(serializeVaultDoc) },
    { status: 200, headers: NO_CACHE }
  );
}

export async function POST(req: Request) {
  const ctx = await getVaultSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid vault item data." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const cleanUrl = normalizeDisplayUrl(d.url);
  const label = d.label.trim() || inferLabelFromUrl(cleanUrl);

  const uniqueCodes = Array.from(
    new Set(d.securityCodes.map((c) => c.trim()).filter(Boolean))
  );

  const encryptedCodes: StoredSecurityCode[] = uniqueCodes.map((code) => ({
    id: generateCodeId(),
    encryptedCode: encryptSecret(code),
    length: code.length,
    used: false,
    usedAt: null,
  }));

  const now = new Date();
  const doc = {
    ownerUserId: ctx.userId,
    label,
    url: cleanUrl,
    email: d.email.trim() || null,
    username: d.username.trim() || null,
    encryptedPassword: d.password ? encryptSecret(d.password) : null,
    encryptedTotpSecret: d.totpSecret ? encryptSecret(d.totpSecret) : null,
    securityCodes: encryptedCodes,
    encryptedNotes: d.notes ? encryptSecret(d.notes) : null,
    favorite: Boolean(d.favorite),
    createdAt: now,
    updatedAt: now,
  };

  const { vaultItems } = await getVaultCollections();
  const inserted = await vaultItems.insertOne(doc);

  return NextResponse.json(
    {
      ok: true,
      item: serializeVaultDoc({ _id: inserted.insertedId, ...doc }),
    },
    { status: 201, headers: NO_CACHE }
  );
}
