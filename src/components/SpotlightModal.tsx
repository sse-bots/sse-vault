"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Plus, Search, Smartphone, X } from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { SiteIcon } from "@/components/SiteIcon";
import { getAccountDetailHref } from "@/lib/oauth-links";

export function SpotlightModal() {
  const router = useRouter();
  const {
    spotlightOpen,
    setSpotlightOpen,
    appGroups,
    items,
    openAddModal,
  } = useVault();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchedGroups = q
      ? appGroups.filter(
          (g) =>
            g.appName.toLowerCase().includes(q) ||
            g.domainKey.toLowerCase().includes(q)
        )
      : appGroups.slice(0, 6);

    const matchedItems = q
      ? items
          .filter(
            (i) =>
              i.label.toLowerCase().includes(q) ||
              i.appName.toLowerCase().includes(q) ||
              i.domainKey.toLowerCase().includes(q) ||
              (i.email || "").toLowerCase().includes(q) ||
              (i.username || "").toLowerCase().includes(q)
          )
          .slice(0, 8)
      : [];

    return { matchedGroups, matchedItems };
  }, [query, appGroups, items]);

  if (!spotlightOpen) return null;

  function goToPath(href: string) {
    setSpotlightOpen(false);
    setQuery("");
    router.push(href);
  }

  function goToApp(domainKey: string) {
    goToPath(`/vault/${encodeURIComponent(domainKey)}`);
  }

  return (
    <div
      className="animate-vault-fade fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-16 backdrop-blur-sm sm:pt-24"
      onClick={() => setSpotlightOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-vault-modal vault-card w-full max-w-xl overflow-hidden rounded-3xl shadow-2xl"
      >
        <div className="vault-divider flex items-center gap-3 border-b px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-amber-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to Google, GitHub, email, username..."
            className="vault-text-primary flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={() => setSpotlightOpen(false)}
            className="vault-inset vault-text-muted rounded-lg p-1.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-3">
          {results.matchedGroups.length > 0 && (
            <div>
              <div className="vault-text-muted px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest">
                Apps
              </div>
              <div className="space-y-1">
                {results.matchedGroups.map((g) => (
                  <button
                    key={g.domainKey}
                    type="button"
                    onClick={() => goToApp(g.domainKey)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-amber-500/10"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SiteIcon
                        domainOrUrl={g.domainKey}
                        label={g.appName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="vault-text-primary truncate text-xs font-bold">
                          {g.appName}
                        </div>
                        <div className="vault-text-muted truncate font-mono text-[11px]">
                          {g.domainKey} · {g.accountCount} account
                          {g.accountCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="vault-text-muted h-4 w-4 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.matchedItems.length > 0 && (
            <div>
              <div className="vault-text-muted px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest">
                Matching Accounts
              </div>
              <div className="space-y-1">
                {results.matchedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToPath(getAccountDetailHref(item))}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-amber-500/10"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SiteIcon
                        domainOrUrl={item.domainKey}
                        label={item.appName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="vault-text-primary truncate text-xs font-bold">
                          {item.email || item.username || item.label}
                        </div>
                        <div className="vault-text-muted truncate text-[11px]">
                          {item.appName} ({item.domainKey})
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.totpSecret && (
                        <Smartphone className="h-3.5 w-3.5 text-cyan-500" />
                      )}
                      {item.securityCodes.length > 0 && (
                        <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.matchedGroups.length === 0 &&
            results.matchedItems.length === 0 && (
              <div className="py-8 text-center">
                <p className="vault-text-muted text-xs">
                  No vault entries match &ldquo;{query}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSpotlightOpen(false);
                    openAddModal(null);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-zinc-950"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add New Entry
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
