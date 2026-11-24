"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  KeyRound,
  Lock,
  LogIn,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { SiteIcon } from "@/components/SiteIcon";
import { VaultEntryCard } from "@/components/VaultEntryCard";
import { KeyRecoveryBanner } from "@/components/KeyRecoveryBanner";
import { extractDomainKey, getAppNameForDomain } from "@/lib/domain";

export default function VaultAppDetailPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain: rawParam } = use(params);
  const decodedDomain = useMemo(() => {
    try {
      return (
        extractDomainKey(decodeURIComponent(rawParam)) || rawParam.toLowerCase()
      );
    } catch {
      return rawParam.toLowerCase();
    }
  }, [rawParam]);

  const appName = useMemo(
    () => getAppNameForDomain(decodedDomain),
    [decodedDomain]
  );

  const { user, authLoading, items, vaultLoading, openAddModal } = useVault();
  const [search, setSearch] = useState("");

  const appItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => i.domainKey === decodedDomain)
      .filter((i) => {
        if (!q) return true;
        return (
          i.label.toLowerCase().includes(q) ||
          (i.email || "").toLowerCase().includes(q) ||
          (i.username || "").toLowerCase().includes(q) ||
          (i.oauthProvider || "").toLowerCase().includes(q) ||
          i.url.toLowerCase().includes(q)
        );
      });
  }, [items, decodedDomain, search]);

  const stats = useMemo(() => {
    const totpCount = appItems.filter((i) => Boolean(i.totpSecret)).length;
    const unusedKeys = appItems.reduce(
      (sum, i) => sum + i.securityCodes.filter((c) => !c.used).length,
      0
    );
    return { totpCount, unusedKeys };
  }, [appItems]);

  if (authLoading) {
    return (
      <div className="vault-text-muted py-20 text-center text-sm">
        Verifying session...
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
        <Link
          href={`/sign-in?next=${encodeURIComponent(`/vault/${decodedDomain}`)}`}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950"
        >
          <LogIn className="h-4 w-4" />
          Sign in with SSE Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <KeyRecoveryBanner />

      <Link
        href="/vault"
        className="vault-text-muted inline-flex items-center gap-1.5 text-xs font-bold transition hover:text-amber-500"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to All Apps
      </Link>

      {/* Dedicated App Banner */}
      <section className="vault-card flex flex-col justify-between gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
          <SiteIcon domainOrUrl={decodedDomain} label={appName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="vault-text-primary truncate text-xl font-black sm:text-3xl">
                {appName}
              </h1>
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-500">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                <span className="truncate">Only {decodedDomain}</span>
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
              <a
                href={`https://${decodedDomain}`}
                target="_blank"
                rel="noreferrer"
                className="vault-text-muted inline-flex items-center gap-1 font-mono hover:text-amber-500 hover:underline"
              >
                <span className="truncate">{decodedDomain}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <span className="vault-text-muted">·</span>
              <span className="vault-text-secondary font-semibold">
                {appItems.length}{" "}
                {appItems.length === 1 ? "Account" : "Accounts"}
              </span>
              {stats.totpCount > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-cyan-500">
                  <Smartphone className="h-3 w-3" />
                  {stats.totpCount} TOTP
                </span>
              )}
              {stats.unusedKeys > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                  <KeyRound className="h-3 w-3" />
                  {stats.unusedKeys} Keys
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openAddModal(decodedDomain)}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-xs font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add {appName} Account
        </button>
      </section>

      {appItems.length > 1 && (
        <div className="relative w-full sm:max-w-sm">
          <Search className="vault-text-muted pointer-events-none absolute left-3.5 top-2.5 h-4 w-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Filter ${appName} accounts...`}
            className="vault-input w-full rounded-2xl py-2 pl-10 pr-4 text-xs"
          />
        </div>
      )}

      {vaultLoading && items.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="vault-card h-64 animate-pulse rounded-3xl"
            />
          ))}
        </div>
      ) : appItems.length === 0 ? (
        <div className="vault-card rounded-3xl p-8 text-center sm:p-10">
          <div className="mx-auto mb-3 flex justify-center">
            <SiteIcon domainOrUrl={decodedDomain} label={appName} size="lg" />
          </div>
          <h2 className="vault-text-primary text-base font-extrabold">
            No {appName} accounts saved yet
          </h2>
          <p className="vault-text-muted mx-auto mt-1.5 max-w-md text-xs">
            Add your first <code>{decodedDomain}</code> password login, OAuth
            login, TOTP secret, or backup <code>.txt</code> security keys. Only{" "}
            <code>{decodedDomain}</code> URLs are accepted here.
          </p>
          <button
            type="button"
            onClick={() => openAddModal(decodedDomain)}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950 hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" />
            Add {appName} Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {appItems.map((item) => (
            <VaultEntryCard
              key={item.id}
              item={item}
              lockedDomain={decodedDomain}
            />
          ))}
        </div>
      )}
    </div>
  );
}
