"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  KeyRound,
  Lock,
  LogIn,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  Upload,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { SiteIcon } from "@/components/SiteIcon";
import { KeyRecoveryBanner } from "@/components/KeyRecoveryBanner";
import { VAULT_CATEGORIES, type VaultCategory } from "@/lib/vault-types";

type AppFilter = "all" | "oauth" | "totp" | "keys" | "favorites";

export default function VaultAppsDirectoryPage() {
  const {
    user,
    authLoading,
    items,
    appGroups,
    vaultLoading,
    vaultError,
    privacyBlur,
    openAddModal,
    openImportExportModal,
    refreshVault,
  } = useVault();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AppFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<VaultCategory | "all">(
    "all"
  );

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appGroups.filter((g) => {
      if (filter === "oauth" && g.oauthCount === 0) return false;
      if (filter === "totp" && g.totpCount === 0) return false;
      if (filter === "keys" && g.totalCodesCount === 0) return false;
      if (filter === "favorites" && !g.hasFavorite) return false;
      if (
        categoryFilter !== "all" &&
        !g.categories.includes(categoryFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        g.appName.toLowerCase().includes(q) ||
        g.domainKey.toLowerCase().includes(q) ||
        g.previewIdentities.some((id) => id.toLowerCase().includes(q))
      );
    });
  }, [appGroups, query, filter, categoryFilter]);

  const totals = useMemo(() => {
    const totalTotp = items.filter((i) => Boolean(i.totpSecret)).length;
    const totalUnusedKeys = items.reduce(
      (sum, i) => sum + i.securityCodes.filter((c) => !c.used).length,
      0
    );
    return {
      apps: appGroups.length,
      accounts: items.length,
      totalTotp,
      totalUnusedKeys,
    };
  }, [items, appGroups]);

  if (authLoading) {
    return (
      <div className="vault-text-muted py-20 text-center text-sm">
        Verifying SSE session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="vault-card mx-auto mt-12 max-w-md rounded-3xl p-8 text-center">
        <Lock className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h1 className="vault-text-primary text-xl font-extrabold">
          Sign in required
        </h1>
        <p className="vault-text-muted mt-2 text-xs">
          Authenticate with SSE Accounts to open your encrypted apps vault.
        </p>
        <Link
          href="/sign-in?next=/vault"
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950 hover:bg-amber-400"
        >
          <LogIn className="h-4 w-4" />
          Sign in with SSE Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Only appears if encryption secret changed and fallback/locked was triggered */}
      <KeyRecoveryBanner />

      {/* Bento Header Stats Strip */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <div className="vault-card min-w-0 rounded-2xl p-3.5 sm:p-4">
          <div className="vault-text-muted truncate text-[10px] font-bold uppercase tracking-wider">
            Apps / Sites
          </div>
          <div className="vault-text-primary mt-1 text-xl font-black sm:text-2xl">
            {totals.apps}
          </div>
        </div>
        <div className="vault-card min-w-0 rounded-2xl p-3.5 sm:p-4">
          <div className="vault-text-muted truncate text-[10px] font-bold uppercase tracking-wider">
            Accounts
          </div>
          <div className="vault-text-primary mt-1 text-xl font-black sm:text-2xl">
            {totals.accounts}
          </div>
        </div>
        <Link
          href="/vault/authenticator"
          className="vault-card-interactive min-w-0 rounded-2xl p-3.5 sm:p-4"
        >
          <div className="truncate text-[10px] font-bold uppercase tracking-wider text-cyan-500">
            Live TOTP
          </div>
          <div className="vault-text-primary mt-1 text-xl font-black sm:text-2xl">
            {totals.totalTotp}
          </div>
        </Link>
        <Link
          href="/vault/health"
          className="vault-card-interactive min-w-0 rounded-2xl p-3.5 sm:p-4"
        >
          <div className="truncate text-[10px] font-bold uppercase tracking-wider text-amber-500">
            Unused Keys
          </div>
          <div className="vault-text-primary mt-1 text-xl font-black sm:text-2xl">
            {totals.totalUnusedKeys}
          </div>
        </Link>
      </section>

      {/* Search + Horizontal-Safe Filter Controls */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="vault-text-muted pointer-events-none absolute left-3.5 top-2.5 h-4 w-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps (Google, GitHub...) or email..."
              className="vault-input w-full rounded-2xl py-2.5 pl-10 pr-4 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => openImportExportModal("import")}
            title="Import or Export Passwords"
            className="vault-card vault-text-secondary inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold hover:border-amber-500 hover:text-amber-500"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import / Export</span>
          </button>

          <button
            type="button"
            onClick={refreshVault}
            disabled={vaultLoading}
            title="Sync vault"
            className="vault-card vault-text-secondary shrink-0 rounded-xl p-2.5 hover:border-amber-500 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${vaultLoading ? "animate-spin" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={() => openAddModal(null)}
            className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-zinc-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 sm:inline-flex"
          >
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        </div>

        {/* Scrollable Pill Filter Bar (zero mobile wrapping overflow!) */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          <div className="vault-inset flex shrink-0 items-center gap-1 rounded-full p-1">
            {(
              [
                { id: "all", label: "All" },
                { id: "oauth", label: "OAuth" },
                { id: "totp", label: "TOTP" },
                { id: "keys", label: "Keys" },
                { id: "favorites", label: "Favorites" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition ${
                  filter === tab.id
                    ? "bg-amber-500 text-zinc-950"
                    : "vault-text-muted hover:text-amber-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as VaultCategory | "all")
            }
            className="vault-input shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
          >
            <option value="all">All Categories</option>
            {VAULT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {vaultError && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-400">
          {vaultError}
        </div>
      )}

      {/* Apps Directory Grid */}
      {vaultLoading && items.length === 0 ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="vault-card h-32 animate-pulse rounded-3xl"
            />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="vault-card rounded-3xl p-8 text-center sm:p-10">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h2 className="vault-text-primary text-base font-extrabold sm:text-lg">
            {appGroups.length === 0
              ? "Add your first app to SSE Vault"
              : "No matching apps found"}
          </h2>
          <p className="vault-text-muted mx-auto mt-1.5 max-w-md text-xs leading-relaxed">
            {appGroups.length === 0
              ? "Enter any website URL (like google.com or github.com) — SSE Vault fetches its real icon, creates an app folder, and automatically segregates future accounts from that site inside it."
              : "Try clearing your search or switching filter tabs."}
          </p>
          {appGroups.length === 0 && (
            <button
              type="button"
              onClick={() => openAddModal(null)}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950 hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              Add First Account
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3">
          {filteredGroups.map((group) => (
            <Link
              key={group.domainKey}
              href={`/vault/${encodeURIComponent(group.domainKey)}`}
              className="vault-card-interactive group flex min-w-0 flex-col justify-between gap-3.5 rounded-3xl p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SiteIcon
                    domainOrUrl={group.domainKey}
                    label={group.appName}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="vault-text-primary truncate text-base font-extrabold group-hover:text-amber-500">
                        {group.appName}
                      </h2>
                      {group.hasFavorite && (
                        <Star
                          className="h-3.5 w-3.5 shrink-0 text-amber-500"
                          fill="currentColor"
                        />
                      )}
                      {group.hasLockedOrRecovered && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      )}
                    </div>
                    <div className="vault-text-muted truncate font-mono text-[11px]">
                      {group.domainKey}
                    </div>
                  </div>
                </div>

                <span className="vault-inset vault-text-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition group-hover:bg-amber-500 group-hover:text-zinc-950">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>

              {group.previewIdentities.length > 0 && (
                <div className="vault-text-muted truncate font-mono text-[11px]">
                  <span className={privacyBlur ? "blur-sm select-none" : ""}>
                    {group.previewIdentities.join(" · ")}
                    {group.accountCount > 2
                      ? ` +${group.accountCount - 2} more`
                      : ""}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="vault-inset vault-text-primary rounded-full px-2.5 py-0.5 text-[10px] font-extrabold">
                  {group.accountCount}{" "}
                  {group.accountCount === 1 ? "Account" : "Accounts"}
                </span>

                {group.oauthCount > 0 && (
                  <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[10px] font-bold text-violet-400">
                    {group.oauthCount} OAuth
                  </span>
                )}

                {group.totpCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold text-cyan-500">
                    <Smartphone className="h-3 w-3" />
                    {group.totpCount} TOTP
                  </span>
                )}

                {group.totalCodesCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      group.unusedCodesCount === 0
                        ? "bg-rose-500/15 text-rose-500"
                        : "bg-amber-500/15 text-amber-500"
                    }`}
                  >
                    <KeyRound className="h-3 w-3" />
                    {group.unusedCodesCount}/{group.totalCodesCount}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
