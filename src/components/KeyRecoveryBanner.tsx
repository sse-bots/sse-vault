"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";

/**
 * Only renders when VAULT_ENCRYPTION_SECRET changed and could not directly decode
 * one or more vault entries (either recovered automatically via MongoDB `hexcode`
 * or locked requiring the old 64-char hex key). Invisible during normal operation!
 */
export function KeyRecoveryBanner() {
  const { recoveredCount, lockedCount, refreshVault, showToast } = useVault();
  const [migrating, setMigrating] = useState(false);

  if (recoveredCount === 0 && lockedCount === 0) return null;

  async function handleAutoReencrypt() {
    setMigrating(true);
    try {
      const res = await fetch("/api/vault/reencrypt", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Could not re-encrypt entries.");
        return;
      }
      await refreshVault();
      showToast(
        `Re-encrypted ${j.migratedCount} entry(s) with your current secret!`
      );
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div
      className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${
        lockedCount > 0
          ? "border-rose-500/45 bg-rose-500/10"
          : "border-amber-500/45 bg-amber-500/10"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        {lockedCount > 0 ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        )}
        <div className="min-w-0 text-xs">
          <div className="vault-text-primary font-extrabold">
            {lockedCount > 0
              ? `${lockedCount} Entry(s) Locked After Secret Change`
              : `Secret Rotation Detected — ${recoveredCount} Entry(s) Decoded via DB Hexcode`}
          </div>
          <p className="vault-text-secondary mt-0.5 leading-relaxed">
            {lockedCount > 0
              ? "Your VAULT_ENCRYPTION_SECRET changed and these older entries have no stored hexcode. Paste your previous 64-char hex key in Settings to unlock & re-encrypt them."
              : "Your current VAULT_ENCRYPTION_SECRET could not decode these entries directly, so SSE Vault automatically decoded them using each entry's saved database hexcode."}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {recoveredCount > 0 && (
          <button
            type="button"
            disabled={migrating}
            onClick={handleAutoReencrypt}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {migrating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Re-Encrypt to Current Secret
          </button>
        )}
        {lockedCount > 0 && (
          <Link
            href="/vault/settings#key-recovery"
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-rose-400"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Unlock with Old Hex Key
          </Link>
        )}
      </div>
    </div>
  );
}
