"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { SiteIcon } from "@/components/SiteIcon";
import type { VaultItemDTO } from "@/lib/vault-types";

type TrashedItem = VaultItemDTO & { daysRemaining: number };

export default function VaultTrashPage() {
  const { user, authLoading, refreshVault, showToast } = useVault();
  const [trashed, setTrashed] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vault/trash", { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) setTrashed(j.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) void loadTrash();
  }, [authLoading, user, loadTrash]);

  async function restore(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/vault/trash", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", id }),
      });
      if (res.ok) {
        setTrashed((prev) => prev.filter((x) => x.id !== id));
        await refreshVault();
        showToast("Restored item back to your vault.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function deleteForever(id: string) {
    if (!confirm("Permanently erase this item? This cannot be undone.")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/vault/trash", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (res.ok) {
        setTrashed((prev) => prev.filter((x) => x.id !== id));
        showToast("Permanently deleted.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function emptyTrash() {
    if (!confirm(`Permanently delete all ${trashed.length} trashed items?`)) return;
    setBusyId("empty");
    try {
      const res = await fetch("/api/vault/trash", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "empty" }),
      });
      if (res.ok) {
        setTrashed([]);
        showToast("Trash emptied permanently.");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/vault" className="vault-text-muted inline-flex items-center gap-1.5 text-xs font-bold hover:text-amber-500">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to All Apps
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="vault-text-primary flex items-center gap-2 text-2xl font-black">
            <Trash2 className="h-6 w-6 text-rose-500" />
            Trash Bin
          </h1>
          <p className="vault-text-muted mt-1 text-xs">
            Deleted logins, notes, and cards stay recoverable here for 30 days before automatic permanent erasure.
          </p>
        </div>

        {trashed.length > 0 && (
          <button
            type="button"
            disabled={busyId !== null}
            onClick={emptyTrash}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-xs font-extrabold text-rose-400 hover:bg-rose-500/25 disabled:opacity-50"
          >
            {busyId === "empty" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Empty Trash ({trashed.length})
          </button>
        )}
      </div>

      {loading ? (
        <div className="vault-text-muted py-16 text-center text-sm">Loading trash...</div>
      ) : trashed.length === 0 ? (
        <div className="vault-card rounded-3xl p-10 text-center">
          <Trash2 className="vault-text-muted mx-auto mb-3 h-10 w-10 opacity-50" />
          <div className="vault-text-primary text-base font-extrabold">Trash is empty</div>
          <p className="vault-text-muted mt-1 text-xs">Deleted vault items will appear here for 30 days.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trashed.map((item) => (
            <div key={item.id} className="vault-card flex flex-col justify-between gap-3 rounded-3xl p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <SiteIcon domainOrUrl={item.domainKey} label={item.appName} size="md" />
                <div className="min-w-0">
                  <div className="vault-text-primary truncate text-sm font-extrabold">{item.label}</div>
                  <div className="vault-text-muted truncate font-mono text-[11px]">{item.email || item.username || item.domainKey}</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                    <Clock className="h-2.5 w-2.5" />
                    {item.daysRemaining} day{item.daysRemaining === 1 ? "" : "s"} left
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => restore(item.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Restore
                </button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => deleteForever(item.id)}
                  className="vault-inset rounded-xl px-3 py-2 text-xs font-bold text-rose-400 hover:border-rose-500 disabled:opacity-50"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
