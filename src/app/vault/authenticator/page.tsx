"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Lock, LogIn, Plus, Search, Smartphone } from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { SiteIcon } from "@/components/SiteIcon";
import { TotpLiveWidget } from "@/components/TotpLiveWidget";

export default function VaultAuthenticatorPage() {
  const { user, authLoading, items, privacyBlur, openAddModal, showToast } =
    useVault();
  const [query, setQuery] = useState("");

  const totpItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => Boolean(i.totpSecret))
      .filter((i) => {
        if (!q) return true;
        return (
          i.appName.toLowerCase().includes(q) ||
          i.domainKey.toLowerCase().includes(q) ||
          i.label.toLowerCase().includes(q) ||
          (i.email || "").toLowerCase().includes(q) ||
          (i.username || "").toLowerCase().includes(q)
        );
      });
  }, [items, query]);

  if (authLoading) {
    return (
      <div className="vault-text-muted py-20 text-center text-sm">
        Loading authenticator...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="vault-card mx-auto mt-12 max-w-md rounded-3xl p-8 text-center">
        <Lock className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <Link
          href="/sign-in?next=/vault/authenticator"
          className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950"
        >
          <LogIn className="h-4 w-4" />
          Sign in with SSE Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="vault-text-primary text-2xl font-black sm:text-3xl">
            Live 2FA Authenticator
          </h1>
          <p className="vault-text-muted mt-1 text-xs">
            All {totpItems.length} real-time TOTP codes across your apps in one
            place. Tap any code to copy instantly.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="vault-text-muted pointer-events-none absolute left-3.5 top-2.5 h-4 w-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter authenticator..."
            className="vault-input w-full rounded-2xl py-2 pl-10 pr-4 text-xs"
          />
        </div>
      </div>

      {totpItems.length === 0 ? (
        <div className="vault-card rounded-3xl p-10 text-center">
          <Smartphone className="mx-auto mb-3 h-10 w-10 text-cyan-500" />
          <h2 className="vault-text-primary text-base font-extrabold">
            No TOTP secrets added yet
          </h2>
          <p className="vault-text-muted mx-auto mt-1.5 max-w-md text-xs">
            Add a TOTP secret key or <code>otpauth://</code> URI to any account
            to see live 30-second verification codes here.
          </p>
          <button
            type="button"
            onClick={() => openAddModal(null)}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950 hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" />
            Add TOTP Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {totpItems.map((item) => (
            <div key={item.id} className="vault-card space-y-3 rounded-3xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <SiteIcon
                    domainOrUrl={item.domainKey}
                    label={item.appName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="vault-text-primary truncate text-xs font-extrabold">
                      {item.appName}
                    </div>
                    <div className="vault-text-muted truncate font-mono text-[11px]">
                      {item.email || item.username || item.label}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/vault/${encodeURIComponent(item.domainKey)}`}
                  title={`Open ${item.appName}`}
                  className="vault-inset vault-text-muted rounded-xl p-1.5 hover:text-amber-500"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <TotpLiveWidget
                secret={item.totpSecret!}
                privacyBlur={privacyBlur}
                compact
                onCopied={() =>
                  showToast(`${item.appName} TOTP code copied!`)
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
