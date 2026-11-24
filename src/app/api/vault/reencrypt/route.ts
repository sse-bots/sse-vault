import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUnlockedVaultSession } from "@/lib/vault-pin";
import { getVaultCollections } from "@/lib/mongodb";
import {
  decryptSecretWithKey,
  decryptWithFallback,
  encryptSecretWithKey,
  getActiveKeyHex,
  getKeyFingerprint,
  normalizeHexKey,
  shouldStoreHexcodeInDb,
} from "@/lib/crypto";
import type { StoredSecurityCode } from "@/lib/vault-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reencryptSchema = z.object({
  /** Optional: paste an old 64-char hex key to rescue locked entries that didn't have a stored `hexcode` */
  oldHexKey: z.string().trim().max(256).optional(),
});

export async function POST(req: Request) {
  const guard = await requireUnlockedVaultSession();
  if (!guard.ok) return guard.response;
  const ctx = guard.session;

  const body = await req.json().catch(() => ({}));
  const parsed = reencryptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const manualOldHex = parsed.data.oldHexKey
    ? normalizeHexKey(parsed.data.oldHexKey)
    : null;
  const activeHex = getActiveKeyHex();
  const activeFingerprint = getKeyFingerprint(activeHex);
  const storeHex = shouldStoreHexcodeInDb();

  const { vaultItems } = await getVaultCollections();
  const docs = await vaultItems.find({ ownerUserId: ctx.userId }).toArray();

  let migratedCount = 0;
  let stillLockedCount = 0;

  const tryDecode = (
    payload: string | null | undefined,
    docHex: string | null
  ): { value: string | null; needsReencrypt: boolean; failed: boolean } => {
    if (!payload) return { value: null, needsReencrypt: false, failed: false };

    const auto = decryptWithFallback(payload, docHex);
    if (auto.source === "primary") {
      return { value: auto.value, needsReencrypt: false, failed: false };
    }
    if (auto.source === "db_hexcode" || auto.source === "legacy_env") {
      return { value: auto.value, needsReencrypt: true, failed: false };
    }
    if (manualOldHex) {
      const rescued = decryptSecretWithKey(payload, manualOldHex);
      if (rescued !== null) {
        return { value: rescued, needsReencrypt: true, failed: false };
      }
    }
    return { value: null, needsReencrypt: false, failed: true };
  };

  for (const doc of docs) {
    const docHex =
      typeof doc.hexcode === "string" && doc.hexcode.trim()
        ? doc.hexcode.trim()
        : null;

    const pwd = tryDecode(
      doc.encryptedPassword ? String(doc.encryptedPassword) : null,
      docHex
    );
    const totp = tryDecode(
      doc.encryptedTotpSecret ? String(doc.encryptedTotpSecret) : null,
      docHex
    );
    const notes = tryDecode(
      doc.encryptedNotes ? String(doc.encryptedNotes) : null,
      docHex
    );

    let anyFailed = pwd.failed || totp.failed || notes.failed;
    let anyNeedsReencrypt =
      pwd.needsReencrypt ||
      totp.needsReencrypt ||
      notes.needsReencrypt ||
      doc.keyFingerprint !== activeFingerprint ||
      (storeHex && docHex !== activeHex);

    const rawCodes: StoredSecurityCode[] = Array.isArray(doc.securityCodes)
      ? (doc.securityCodes as StoredSecurityCode[])
      : [];

    const nextCodes: StoredSecurityCode[] = rawCodes.map((c) => {
      const codeHex =
        typeof c.hexcode === "string" && c.hexcode.trim()
          ? c.hexcode.trim()
          : docHex;
      const dec = tryDecode(c.encryptedCode, codeHex);
      if (dec.failed) {
        anyFailed = true;
        return c;
      }
      if (dec.needsReencrypt || (storeHex && c.hexcode !== activeHex)) {
        anyNeedsReencrypt = true;
      }
      if (dec.value !== null && (dec.needsReencrypt || c.hexcode !== activeHex)) {
        return {
          ...c,
          encryptedCode: encryptSecretWithKey(dec.value, activeHex),
          ...(storeHex ? { hexcode: activeHex } : {}),
        };
      }
      return c;
    });

    if (anyFailed) {
      stillLockedCount += 1;
      // Still migrate any fields that DID decode if possible? Safer: skip partial failure so we don't overwrite doc.hexcode
      continue;
    }

    if (anyNeedsReencrypt) {
      const updates: Record<string, unknown> = {
        keyFingerprint: activeFingerprint,
        updatedAt: new Date(),
      };
      if (storeHex) updates.hexcode = activeHex;
      if (pwd.value !== null) {
        updates.encryptedPassword = encryptSecretWithKey(pwd.value, activeHex);
      }
      if (totp.value !== null) {
        updates.encryptedTotpSecret = encryptSecretWithKey(
          totp.value,
          activeHex
        );
      }
      if (notes.value !== null) {
        updates.encryptedNotes = encryptSecretWithKey(notes.value, activeHex);
      }
      if (rawCodes.length > 0) {
        updates.securityCodes = nextCodes;
      }

      await vaultItems.updateOne({ _id: doc._id }, { $set: updates });
      migratedCount += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    migratedCount,
    stillLockedCount,
    activeKeyFingerprint: activeFingerprint,
  });
}
