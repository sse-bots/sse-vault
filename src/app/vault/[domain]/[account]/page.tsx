"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  KeyRound,
  Link2,
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
import {
  findAccountByParam,
  findParentOAuthAccount,
  getAccountDetailHref,
  getConnectedOAuthEntries,
} from "@/lib/oauth-links";

export default function VaultAccountDetailPage({
  params,
}: {
  params: Promise<{ domain: string; account: string }>;
}) {
  const router = useRouter();
  const { domain: rawDomain, account: rawAccount } = use(params);

  const decodedDomain = useMemo(() => {
    try {
      return (
        extractDomainKey(decodeURIComponent(rawDomain)) ||
        rawDomain.toLowerCase()
      );
    } catch {
      return rawDomain.toLowerCase();
    }
  }, [rawDomain]);

  const decodedAccountParam = useMemo(() => {
    try {
      return decodeURIComponent(rawAccount);
    } catch {
      return rawAccount;
    }
  }, [rawAccount]);

  const appName = useMemo(
    () => getAppNameForDomain(decodedDomain),
    [decodedDomain]
  );

  const { user, authLoading, items, vaultLoading, privacyBlur, openAddModal } =
    useVault();

  const [oauthFilter, setOauthFilter] = useState("");

  const accountItem = useMemo(
    () => findAccountByParam(items, decodedDomain, decodedAccountParam),
    [items, decodedDomain, decodedAccountParam]
  );

  const connectedOAuths = useMemo(
    () => (accountItem ? getConnectedOAuthEntries(accountItem, items) : []),
    [accountItem, items]
  );

  const filteredConnectedOAuths = useMemo(() => {
    const q = oauthFilter.trim().toLowerCase();
    if (!q) return connectedOAuths;
    return connectedOAuths.filter(
      (c) =>
        c.appName.toLowerCase().includes(q) ||
        c.domainKey.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [connectedOAuths, oauthFilter]);

  const parentAccount = useMemo(
    () => (accountItem ? findParentOAuthAccount(accountItem, items) : null),
    [accountItem, items]
  );

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
          href={`/sign-in?next=${encodeURIComponent(`/vault/${decodedDomain}/${decodedAccountParam}`)}`}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950"
        >
          <LogIn className="h-4 w-4" />
          Sign in with SSE Accounts
        </Link>
      </div>
    );
  }

  if (vaultLoading && !accountItem) {
    return (
      <div className="space-y-4">
        <div className="vault-card h-28 animate-pulse rounded-3xl" />
        <div className="vault-card h-72 animate-pulse rounded-3xl" />
      </div>
    );
  }

  if (!accountItem) {
    return (
      <div className="space-y-4">
        <Link
          href={`/vault/${encodeURIComponent(decodedDomain)}`}
          className="vault-text-muted inline-flex items-center gap-1.5 text-xs font-bold hover:text-amber-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {appName}
        </Link>

        <div className="vault-card rounded-3xl p-8 text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <SiteIcon domainOrUrl={decodedDomain} label={appName} size="lg" />
          </div>
          <h1 className="vault-text-primary text-lg font-extrabold">
            Account Not Found
          </h1>
          <p className="vault-text-muted mx-auto mt-1.5 max-w-md text-xs">
            Could not find <code>{decodedAccountParam}</code> inside{" "}
            <strong>{appName}</strong>.
          </p>
          <Link
            href={`/vault/${encodeURIComponent(decodedDomain)}`}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950"
          >
            View All {appName} Accounts
          </Link>
        </div>
      </div>
    );
  }

  const displayAccountTitle =
    accountItem.username ||
    accountItem.email ||
    accountItem.label ||
    accountItem.appName;

  return (
    <div className="space-y-5 sm:space-y-6">
      <KeyRecoveryBanner />

      {/* Breadcrumbs: All Apps / GitHub / sseworld */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-xs font-bold"
      >
        <Link
          href="/vault"
          className="vault-text-muted transition hover:text-amber-500"
        >
          All Apps
        </Link>
        <ChevronRight className="vault-text-muted h-3.5 w-3.5 shrink-0" />
        <Link
          href={`/vault/${encodeURIComponent(decodedDomain)}`}
          className="vault-text-muted transition hover:text-amber-500"
        >
          {appName}
        </Link>
        <ChevronRight className="vault-text-muted h-3.5 w-3.5 shrink-0" />
        <span className="vault-text-primary max-w-[200px] truncate sm:max-w-xs">
          {displayAccountTitle}
        </span>
      </nav>

      {/* Account Hero Summary */}
      <section className="vault-card flex flex-col justify-between gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
          <SiteIcon domainOrUrl={decodedDomain} label={appName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="vault-text-primary truncate text-xl font-black sm:text-2xl">
                {displayAccountTitle}
              </h1>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-500">
                {appName}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
              <span className="vault-text-muted font-mono">
                {accountItem.domainKey}
              </span>
              {accountItem.email &&
                accountItem.email !== displayAccountTitle && (
                  <>
                    <span className="vault-text-muted">·</span>
                    <span
                      className={`vault-text-secondary truncate font-mono ${
                        privacyBlur ? "blur-sm select-none" : ""
                      }`}
                    >
                      {accountItem.email}
                    </span>
                  </>
                )}
              <span className="vault-text-muted">·</span>
              <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                <Link2 className="h-3 w-3" />
                {connectedOAuths.length} Connected OAuth
                {connectedOAuths.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openAddModal(null, accountItem)}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Connect New Website
        </button>
      </section>

      {/* Main Two-Column Responsive Layout: Left = Full Account Details, Right = Separate Connected OAuths Section */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Full Account Details Card */}
        <div className="space-y-4 lg:col-span-6">
          <VaultEntryCard
            item={accountItem}
            lockedDomain={decodedDomain}
            isDetailView
            onAfterDelete={() =>
              router.replace(`/vault/${encodeURIComponent(decodedDomain)}`)
            }
          />

          {/* Parent OAuth Chain Banner (if this account itself signs in via another provider) */}
          {parentAccount && (
            <section className="vault-card space-y-2.5 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-500">
                <ShieldCheck className="h-4 w-4" />
                Parent OAuth Provider Account
              </div>
              <Link
                href={getAccountDetailHref(parentAccount)}
                className="vault-inset flex items-center justify-between gap-3 rounded-2xl p-3 transition hover:border-amber-500"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <SiteIcon
                    domainOrUrl={parentAccount.domainKey}
                    label={parentAccount.appName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="vault-text-primary truncate text-xs font-extrabold">
                      {parentAccount.appName}
                    </div>
                    <div
                      className={`vault-text-muted truncate font-mono text-[11px] ${
                        privacyBlur ? "blur-sm select-none" : ""
                      }`}
                    >
                      {parentAccount.username ||
                        parentAccount.email ||
                        parentAccount.label}
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-amber-500" />
              </Link>
            </section>
          )}
        </div>

        {/* Right: Dedicated Separate `OAuths` Section */}
        <section
          id="oauths"
          className="vault-card flex flex-col space-y-4 rounded-3xl p-4 sm:p-5 lg:col-span-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                <Link2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="vault-text-primary text-base font-extrabold">
                  Connected OAuths ({connectedOAuths.length})
                </h2>
                <p className="vault-text-muted text-[11px]">
                  Websites &amp; apps signed in using this {appName} account
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openAddModal(null, accountItem)}
              className="vault-inset vault-text-primary inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold transition hover:border-amber-500 hover:text-amber-500"
            >
              <Plus className="h-3.5 w-3.5 text-amber-500" />
              Connect Site
            </button>
          </div>

          {connectedOAuths.length > 3 && (
            <div className="relative">
              <Search className="vault-text-muted pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5" />
              <input
                value={oauthFilter}
                onChange={(e) => setOauthFilter(e.target.value)}
                placeholder="Search connected websites..."
                className="vault-input w-full rounded-xl py-2 pl-9 pr-3 text-xs"
              />
            </div>
          )}

          {connectedOAuths.length === 0 ? (
            <div className="vault-inset flex flex-1 flex-col items-center justify-center rounded-2xl p-8 text-center">
              <Link2 className="mb-2.5 h-8 w-8 text-amber-500/70" />
              <div className="vault-text-primary text-sm font-extrabold">
                No Connected OAuths Yet
              </div>
              <p className="vault-text-muted mt-1 max-w-xs text-xs leading-relaxed">
                Whenever you add a website (like Vercel, Render, or Netlify) and
                choose <strong>OAuth → {appName}</strong> with this account, it
                appears right here automatically.
              </p>
              <button
                type="button"
                onClick={() => openAddModal(null, accountItem)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-zinc-950 hover:bg-amber-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Connect First Website
              </button>
            </div>
          ) : filteredConnectedOAuths.length === 0 ? (
            <div className="vault-inset rounded-2xl p-6 text-center text-xs vault-text-muted">
              No connected websites match &ldquo;{oauthFilter}&rdquo;.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredConnectedOAuths.map((conn) => {
                const unusedKeys = conn.securityCodes.filter(
                  (c) => !c.used
                ).length;
                return (
                  <Link
                    key={conn.id}
                    href={getAccountDetailHref(conn)}
                    className="vault-inset group flex items-center justify-between gap-3 rounded-2xl p-3.5 transition hover:border-amber-500/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SiteIcon
                        domainOrUrl={conn.domainKey}
                        label={conn.appName}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="vault-text-primary truncate text-sm font-extrabold group-hover:text-amber-500">
                            {conn.appName}
                          </span>
                          {conn.label && conn.label !== conn.appName && (
                            <span className="vault-card vault-text-muted rounded-full px-2 py-0.5 text-[10px] font-bold">
                              {conn.label}
                            </span>
                          )}
                        </div>
                        <div className="vault-text-muted mt-0.5 truncate font-mono text-[11px]">
                          {conn.domainKey}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {conn.totpSecret && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-500">
                              <Smartphone className="h-2.5 w-2.5" />
                              TOTP
                            </span>
                          )}
                          {conn.securityCodes.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                              <KeyRound className="h-2.5 w-2.5" />
                              {unusedKeys}/{conn.securityCodes.length} keys
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="vault-card vault-text-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition group-hover:bg-amber-500 group-hover:text-zinc-950">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
