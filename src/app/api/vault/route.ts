import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import {
  encryptSecret,
  generateCodeId,
  getActiveKeyHex,
  getKeyFingerprint,
  shouldStoreHexcodeInDb,
} from "@/lib/crypto";
import {
  extractDomainKey,
  getAppNameForDomain,
  isUrlAllowedForDomain,
  normalizeWebsiteUrl,
} from "@/lib/domain";
import { serializeVaultDoc } from "@/lib/vault-serializer";
import type { StoredSecurityCode } from "@/lib/vault-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };

const createItemSchema = z.object({
  label: z.string().trim().max(80).optional().default(""),
  url: z.string().trim().min(1, "Website URL is required.").max(300),
  expectedDomain: z.string().trim().max(120).optional(),
  authType: z.enum(["password", "oauth"]).optional().default("password"),
  oauthProvider: z.string().trim().max(60).optional().default(""),
  category: z
    .enum(["personal", "work", "dev", "gaming", "finance", "social", "other"])
    .optional()
    .default("personal"),
  hasPasskey: z.boolean().optional().default(false),
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

export async function GET(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const { searchParams } = new URL(req.url);
  const domainFilter = (searchParams.get("domain") || "").trim().toLowerCase();

  const { vaultItems } = await getVaultCollections();
  const docs = await vaultItems
    .find({ ownerUserId: ctx.userId })
    .sort({ favorite: -1, updatedAt: -1 })
    .toArray();

  let items = docs.map(serializeVaultDoc);
  if (domainFilter) {
    const normalizedFilter = extractDomainKey(domainFilter) || domainFilter;
    items = items.filter((item) => item.domainKey === normalizedFilter);
  }

  return NextResponse.json(
    {
      items,
      activeKeyFingerprint: getKeyFingerprint(),
      storesHexcodeInDb: shouldStoreHexcodeInDb(),
    },
    { status: 200, headers: NO_CACHE }
  );
}

export async function POST(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const body = await req.json().catch(() => null);
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid vault item data." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const cleanUrl = normalizeWebsiteUrl(d.url);
  const domainKey = extractDomainKey(cleanUrl);
  if (!domainKey) {
    return NextResponse.json(
      {
        error:
          "Please enter a valid website URL (e.g. github.com or google.com).",
      },
      { status: 400 }
    );
  }

  if (d.expectedDomain && !isUrlAllowedForDomain(cleanUrl, d.expectedDomain)) {
    const expectedKey = extractDomainKey(d.expectedDomain);
    const expectedName = getAppNameForDomain(expectedKey);
    return NextResponse.json(
      {
        error: `Only ${expectedKey} URLs are allowed inside ${expectedName}. You entered a ${domainKey} URL.`,
      },
      { status: 400 }
    );
  }

  if (d.authType === "oauth") {
    if (!d.email.trim()) {
      return NextResponse.json(
        { error: "Please enter the email address used for OAuth sign-in." },
        { status: 400 }
      );
    }
  }

  const appName = getAppNameForDomain(domainKey);
  const label = d.label.trim() || appName;

  const activeHex = getActiveKeyHex();
  const keyFingerprint = getKeyFingerprint(activeHex);
  const storeHex = shouldStoreHexcodeInDb();

  const uniqueCodes = Array.from(
    new Set(d.securityCodes.map((c) => c.trim()).filter(Boolean))
  );

  const encryptedCodes: StoredSecurityCode[] = uniqueCodes.map((code) => ({
    id: generateCodeId(),
    encryptedCode: encryptSecret(code),
    length: code.length,
    used: false,
    usedAt: null,
    ...(storeHex ? { hexcode: activeHex } : {}),
  }));

  const now = new Date();
  const doc = {
    ownerUserId: ctx.userId,
    domainKey,
    appName,
    label,
    url: cleanUrl,
    authType: d.authType,
    oauthProvider:
      d.authType === "oauth" ? d.oauthProvider.trim() || "Google" : null,
    category: d.category,
    hasPasskey: Boolean(d.hasPasskey),
    email: d.email.trim() || null,
    username: d.authType === "oauth" ? null : d.username.trim() || null,
    encryptedPassword:
      d.authType === "oauth"
        ? null
        : d.password
          ? encryptSecret(d.password)
          : null,
    encryptedTotpSecret: d.totpSecret ? encryptSecret(d.totpSecret) : null,
    securityCodes: encryptedCodes,
    encryptedNotes: d.notes ? encryptSecret(d.notes) : null,
    favorite: Boolean(d.favorite),
    keyFingerprint,
    ...(storeHex ? { hexcode: activeHex } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const { vaultItems } = await getVaultCollections();
  const existingGroupCount = await vaultItems.countDocuments({
    ownerUserId: ctx.userId,
    domainKey,
  });

  const inserted = await vaultItems.insertOne(doc);

  return NextResponse.json(
    {
      ok: true,
      addedToExistingGroup: existingGroupCount > 0,
      domainKey,
      appName,
      item: serializeVaultDoc({ _id: inserted.insertedId, ...doc }),
    },
    { status: 201, headers: NO_CACHE }
  );
}
