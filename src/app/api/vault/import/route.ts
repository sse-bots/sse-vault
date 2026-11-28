import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
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
  detectVaultCategory,
  extractDomainKey,
  getAppNameForDomain,
  normalizeWebsiteUrl,
} from "@/lib/domain";
import { serializeVaultDoc } from "@/lib/vault-serializer";
import { resolveOAuthProviderDomain } from "@/lib/oauth-links";
import { decryptVaultBackup } from "@/lib/backup-crypto";
import type { StoredSecurityCode, VaultItemDTO } from "@/lib/vault-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };

const importCodeSchema = z.union([
  z.string().trim().min(1).max(128),
  z.object({
    code: z.string().trim().min(1).max(128),
    used: z.boolean().optional().default(false),
  }),
]);

const importEntrySchema = z.object({
  entryType: z.enum(["login", "note", "card"]).optional().default("login"),
  url: z.string().trim().max(300).optional().default(""),
  label: z.string().trim().max(80).optional().default(""),
  authType: z.enum(["password", "oauth"]).optional().default("password"),
  oauthProvider: z.string().trim().max(60).optional().default(""),
  oauthProviderDomain: z.string().trim().max(120).optional().default(""),
  category: z
    .enum(["personal", "work", "dev", "gaming", "finance", "social", "other"])
    .optional()
    .default("personal"),
  hasPasskey: z.boolean().optional().default(false),
  email: z.string().trim().max(160).optional().default(""),
  username: z.string().trim().max(120).optional().default(""),
  password: z.string().max(512).optional().default(""),
  totpSecret: z.string().trim().max(512).optional().default(""),
  securityCodes: z.array(importCodeSchema).max(100).optional().default([]),
  notes: z.string().trim().max(5000).optional().default(""),
  favorite: z.boolean().optional().default(false),
});

const importPayloadSchema = z.object({
  mode: z.enum(["preview", "commit"]).default("preview"),
  conflictStrategy: z.enum(["skip", "update", "duplicate"]).default("skip"),
  entries: z.array(importEntrySchema).min(1).max(500),
});

type MatchStatus = "new" | "exact_duplicate" | "conflict" | "invalid";

function norm(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}

function identitiesMatch(
  incoming: { email: string; username: string; label: string },
  existing: VaultItemDTO
): boolean {
  const inEmail = norm(incoming.email);
  const inUser = norm(incoming.username);
  const exEmail = norm(existing.email);
  const exUser = norm(existing.username);

  if (inEmail && exEmail && inEmail === exEmail) return true;
  if (inUser && exUser && inUser === exUser) return true;
  if (inEmail && exUser && inEmail === exUser) return true;
  if (inUser && exEmail && inUser === exEmail) return true;
  if (!inEmail && !inUser && !exEmail && !exUser) {
    return norm(incoming.label) === norm(existing.label);
  }
  return false;
}

function isExactDuplicate(
  incoming: z.infer<typeof importEntrySchema>,
  existing: VaultItemDTO
): boolean {
  if (incoming.authType !== existing.authType) return false;
  if (incoming.authType === "oauth") {
    return (
      norm(incoming.oauthProvider || "Google") ===
        norm(existing.oauthProvider || "Google") &&
      (incoming.totpSecret || "") === (existing.totpSecret || "")
    );
  }

  const samePassword = (incoming.password || "") === (existing.password || "");
  const sameTotp =
    (incoming.totpSecret || "").trim() === (existing.totpSecret || "").trim();
  const hasNewCodes = incoming.securityCodes.length > 0 && existing.securityCodes.length === 0;
  return samePassword && sameTotp && !hasNewCodes;
}

export async function POST(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  let body = await req.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    typeof (body as Record<string, unknown>).encryptedBackup === "string"
  ) {
    const rawEnc = String((body as Record<string, unknown>).encryptedBackup);
    const pass = String((body as Record<string, unknown>).passphrase || "");
    if (!pass.trim()) {
      return NextResponse.json(
        { error: "Enter the backup passphrase to unlock this .ssevault file." },
        { status: 400, headers: NO_CACHE }
      );
    }
    try {
      const decryptedJson = decryptVaultBackup(rawEnc, pass);
      const parsedJson: unknown = JSON.parse(decryptedJson);
      const rawList: unknown[] = Array.isArray(parsedJson)
        ? parsedJson
        : parsedJson &&
            typeof parsedJson === "object" &&
            Array.isArray((parsedJson as { entries?: unknown[] }).entries)
          ? (parsedJson as { entries: unknown[] }).entries
          : [];
      const mapped = rawList
        .filter(
          (x: unknown): x is Record<string, unknown> =>
            Boolean(x && typeof x === "object")
        )
        .slice(0, 500)
        .map((x) => ({
          entryType:
            x.entryType === "note" || x.entryType === "card"
              ? x.entryType
              : "login",
          url: String(
            x.url ||
              (x.domainKey
                ? `https://${x.domainKey}`
                : "https://secure-note.local")
          ),
          label: String(x.label || x.appName || ""),
          authType: x.authType === "oauth" ? "oauth" : "password",
          oauthProvider: String(x.oauthProvider || ""),
          oauthProviderDomain: String(x.oauthProviderDomain || ""),
          category: String(x.category || "personal"),
          hasPasskey: Boolean(x.hasPasskey),
          email: String(x.email || ""),
          username: String(x.username || ""),
          password: String(x.password || ""),
          totpSecret: String(x.totpSecret || ""),
          securityCodes: Array.isArray(x.securityCodes)
            ? (x.securityCodes as unknown[])
                .map((sc: unknown) =>
                  typeof sc === "string"
                    ? sc
                    : sc &&
                        typeof sc === "object" &&
                        typeof (sc as Record<string, unknown>).code === "string"
                      ? {
                          code: String((sc as Record<string, unknown>).code),
                          used: Boolean((sc as Record<string, unknown>).used),
                        }
                      : null
                )
                .filter(
                  (
                    item: string | { code: string; used: boolean } | null
                  ): item is string | { code: string; used: boolean } =>
                    item !== null
                )
            : [],
          notes: String(x.notes || ""),
          favorite: Boolean(x.favorite),
        }));
      body = {
        mode: (body as Record<string, unknown>).mode || "preview",
        conflictStrategy: (body as Record<string, unknown>).conflictStrategy || "skip",
        entries: mapped,
      };
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not decrypt .ssevault backup." },
        { status: 400, headers: NO_CACHE }
      );
    }
  }
  const parsed = importPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid import payload." },
      { status: 400, headers: NO_CACHE }
    );
  }

  const { mode, conflictStrategy, entries } = parsed.data;
  const { vaultItems } = await getVaultCollections();
  const existingDocs = await vaultItems
    .find({ ownerUserId: ctx.userId, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] })
    .toArray();
  const existingItems = existingDocs.map(serializeVaultDoc);

  // Also track within-file deduplication so importing a CSV with duplicate rows doesn't double-insert
  const seenInBatch = new Set<string>();

  interface EvaluatedRow {
    index: number;
    domainKey: string;
    appName: string;
    identity: string;
    authType: "password" | "oauth";
    status: MatchStatus;
    reason: string;
    matchedExistingId: string | null;
    entry: z.infer<typeof importEntrySchema>;
  }

  const evaluated: EvaluatedRow[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const cleanUrl = normalizeWebsiteUrl(entry.url);
    const domainKey = extractDomainKey(cleanUrl);
    const appName = domainKey ? getAppNameForDomain(domainKey) : "Invalid";
    const identity = entry.email || entry.username || entry.label || appName;

    if (!domainKey) {
      evaluated.push({
        index: i,
        domainKey: "",
        appName: "Invalid URL",
        identity,
        authType: entry.authType,
        status: "invalid",
        reason: "Invalid website URL",
        matchedExistingId: null,
        entry,
      });
      continue;
    }

    const batchKey = `${domainKey}|${norm(entry.email)}|${norm(entry.username)}|${entry.authType}|${entry.password}`;
    if (seenInBatch.has(batchKey)) {
      evaluated.push({
        index: i,
        domainKey,
        appName,
        identity,
        authType: entry.authType,
        status: "exact_duplicate",
        reason: "Duplicate row inside uploaded file",
        matchedExistingId: null,
        entry,
      });
      continue;
    }
    seenInBatch.add(batchKey);

    const sameDomainExisting = existingItems.filter(
      (ex) => ex.domainKey === domainKey
    );
    const matched = sameDomainExisting.find((ex) =>
      identitiesMatch(
        { email: entry.email, username: entry.username, label: entry.label },
        ex
      )
    );

    if (!matched) {
      evaluated.push({
        index: i,
        domainKey,
        appName,
        identity,
        authType: entry.authType,
        status: "new",
        reason: sameDomainExisting.length > 0
          ? `Adds to existing ${appName} folder`
          : `Creates new ${appName} folder`,
        matchedExistingId: null,
        entry,
      });
      continue;
    }

    if (isExactDuplicate(entry, matched)) {
      evaluated.push({
        index: i,
        domainKey,
        appName,
        identity,
        authType: entry.authType,
        status: "exact_duplicate",
        reason: "Already present in your vault (exact match)",
        matchedExistingId: matched.id,
        entry,
      });
    } else {
      evaluated.push({
        index: i,
        domainKey,
        appName,
        identity,
        authType: entry.authType,
        status: "conflict",
        reason: "Same account exists with different password / TOTP / keys",
        matchedExistingId: matched.id,
        entry,
      });
    }
  }

  const summary = {
    total: evaluated.length,
    newCount: evaluated.filter((r) => r.status === "new").length,
    exactDuplicateCount: evaluated.filter((r) => r.status === "exact_duplicate")
      .length,
    conflictCount: evaluated.filter((r) => r.status === "conflict").length,
    invalidCount: evaluated.filter((r) => r.status === "invalid").length,
  };

  if (mode === "preview") {
    return NextResponse.json(
      {
        ok: true,
        summary,
        rows: evaluated.map((r) => ({
          index: r.index,
          domainKey: r.domainKey,
          appName: r.appName,
          identity: r.identity,
          authType: r.authType,
          status: r.status,
          reason: r.reason,
          hasTotp: Boolean(r.entry.totpSecret),
          codesCount: r.entry.securityCodes.length,
        })),
      },
      { headers: NO_CACHE }
    );
  }

  // COMMIT MODE: Insert new items & handle conflicts per strategy
  const activeHex = getActiveKeyHex();
  const keyFingerprint = getKeyFingerprint(activeHex);
  const storeHex = shouldStoreHexcodeInDb();
  const now = new Date();

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  const docsToInsert: Array<Record<string, unknown>> = [];

  for (const row of evaluated) {
    if (row.status === "invalid" || row.status === "exact_duplicate") {
      skippedCount += 1;
      continue;
    }

    const d = row.entry;
    const cleanUrl = normalizeWebsiteUrl(d.url);
    const codesNormalized = d.securityCodes.map((c) =>
      typeof c === "string"
        ? { code: c.trim(), used: false }
        : { code: c.code.trim(), used: Boolean(c.used) }
    );

    const encryptedCodes: StoredSecurityCode[] = codesNormalized
      .filter((c) => c.code)
      .map((c) => ({
        id: generateCodeId(),
        encryptedCode: encryptSecret(c.code),
        length: c.code.length,
        used: c.used,
        usedAt: c.used ? now : null,
        ...(storeHex ? { hexcode: activeHex } : {}),
      }));

    if (row.status === "conflict") {
      if (conflictStrategy === "skip") {
        skippedCount += 1;
        continue;
      }

      if (conflictStrategy === "update" && row.matchedExistingId && ObjectId.isValid(row.matchedExistingId)) {
        const updates: Record<string, unknown> = {
          updatedAt: now,
          keyFingerprint,
          ...(storeHex ? { hexcode: activeHex } : {}),
        };
        if (d.authType === "oauth") {
          updates.authType = "oauth";
          updates.oauthProvider = d.oauthProvider || "Google";
          updates.encryptedPassword = null;
        } else if (d.password) {
          updates.authType = "password";
          updates.encryptedPassword = encryptSecret(d.password);
        }
        if (d.totpSecret) {
          updates.encryptedTotpSecret = encryptSecret(d.totpSecret);
        }
        if (d.notes) {
          updates.encryptedNotes = encryptSecret(d.notes);
        }
        if (encryptedCodes.length > 0) {
          updates.securityCodes = encryptedCodes;
        }

        await vaultItems.updateOne(
          { _id: new ObjectId(row.matchedExistingId), ownerUserId: ctx.userId },
          { $set: updates }
        );
        updatedCount += 1;
        continue;
      }
      // If conflictStrategy === "duplicate", fall through and insert as new!
    }

    docsToInsert.push({
      ownerUserId: ctx.userId,
      entryType: d.entryType,
      domainKey: row.domainKey,
      appName: row.appName,
      label: d.label.trim() || row.appName,
      url: cleanUrl,
      authType: d.authType,
      oauthProvider:
        d.authType === "oauth" ? d.oauthProvider.trim() || "Google" : null,
      oauthProviderDomain:
        d.authType === "oauth"
          ? (d.oauthProviderDomain.trim().toLowerCase() || resolveOAuthProviderDomain({ oauthProvider: d.oauthProvider.trim() || "Google", oauthProviderDomain: null }) || null)
          : null,
      oauthLinkedItemId: null,
      category:
        d.category === "personal" || d.category === "other"
          ? detectVaultCategory(row.domainKey, row.appName, d.label, d.entryType)
          : d.category,
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
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    importedCount += 1;
  }

  if (docsToInsert.length > 0) {
    await vaultItems.insertMany(docsToInsert);
  }

  return NextResponse.json(
    {
      ok: true,
      importedCount,
      updatedCount,
      skippedCount,
      summary,
    },
    { headers: NO_CACHE }
  );
}
