"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Star,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { VaultEntryCard } from "@/components/VaultEntryCard";
import { VaultItemModal } from "@/components/VaultItemModal";
import type { VaultItemDTO } from "@/lib/vault-types";

type FilterMode = "all" | "totp" | "codes" | "favorites" | "low";

export default function VaultDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<VaultItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [privacyBlur, setPrivacyBlur] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItemDTO | null>(null);

  const loadVault = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vault", {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401) {
        setItems([]);
        return;
      }
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not load vault entries.");
        return;
      }
      setItems(j.items || []);
    } catch {
      setError("Network error while loading your vault.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      loadVault();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user, loadVault]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "totp" && !item.totpSecret) return false;
      if (filter === "codes" && item.securityCodes.length === 0) return false;
      if (filter === "favorites" && !item.favorite) return false;
      if (filter === "low") {
        const unused = item.securityCodes.filter((c) => !c.used).length;
        if (item.securityCodes.length === 0 || unused > 2) return false;
      }
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        (item.email || "").toLowerCase().includes(q) ||
        (item.username || "").toLowerCase().includes(q)
      );
    });
  }, [items, query, filter]);

  const stats = useMemo(() => {
    const totpCount = items.filter((i) => Boolean(i.totpSecret)).length;
    const totalUnusedKeys = items.reduce(
      (sum, i) => sum + i.securityCodes.filter((c) => !c.used).length,
      0
    );
    return { total: items.length, totpCount, totalUnusedKeys };
  }, [items]);

  function handleSaved(saved: VaultItemDTO) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      const next = exists
        ? prev.map((i) => (i.id === saved.id ? saved : i))
        : [saved, ...prev];
      return next.sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  if (authLoading) {
    return (
      <div className="py-20 text-center text-sm text-slate-400">
        Verifying SSE session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <Lock className="mx-auto mb-3 h-10 w-10 text-indigo-400" />
        <h1 className="text-xl font-bold text-white">Sign in required</h1>
        <p className="mt-2 text-xs text-slate-400">
          Authenticate with your SSE Account to view and manage your encrypted
          TOTP secrets and backup security keys.
        </p>
        <Link
          href="/sign-in?next=/vault"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
        >
          <LogIn className="h-4 w-4" />
          Sign in with SSE Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
            My Security Vault
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {stats.total} account(s) · {stats.totpCount} live TOTP ·{" "}
            {stats.totalUnusedKeys} unused recovery key(s)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPrivacyBlur((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              privacyBlur
                ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
            }`}
          >
            {privacyBlur ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                Unblur
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Privacy Blur
              </>
            )}
          </button>

          <button
            type="button"
            onClick={loadVault}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Sync
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search URL, service, email, username..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "All", icon: Lock },
              { id: "totp", label: "TOTP", icon: Smartphone },
              { id: "codes", label: "Security Keys", icon: KeyRound },
              { id: "favorites", label: "Favorites", icon: Star },
              { id: "low", label: "Low Keys", icon: KeyRound },
            ] as const
          ).map((f) => {
            const Icon = f.icon;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="h-3 w-3" />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Vault Entries Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-64 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/50"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-10 text-center">
          <KeyRound className="mx-auto mb-3 h-10 w-10 text-slate-500" />
          <h2 className="text-base font-bold text-white">
            {items.length === 0
              ? "Your Vault Is Empty"
              : "No entries match your filter"}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-slate-400">
            {items.length === 0
              ? "Add your first account with its URL, email/username, password, TOTP secret, and upload a .txt recovery codes file."
              : "Try clearing your search or switching filter tabs."}
          </p>
          {items.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setModalOpen(true);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Add First Vault Entry
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredItems.map((item) => (
            <VaultEntryCard
              key={item.id}
              item={item}
              privacyBlur={privacyBlur}
              onEdit={(it) => {
                setEditingItem(it);
                setModalOpen(true);
              }}
              onUpdated={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <VaultItemModal
          initialItem={editingItem}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
