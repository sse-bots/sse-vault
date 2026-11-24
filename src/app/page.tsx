"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileText,
  FolderLock,
  Globe,
  Lock,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { SiteIcon } from "@/components/SiteIcon";

const PREVIEW_APPS = [
  { domain: "google.com", name: "Google", accounts: "3 accounts", meta: "2 live TOTP" },
  { domain: "github.com", name: "GitHub", accounts: "2 accounts", meta: "OAuth + 10 keys" },
  { domain: "discord.com", name: "Discord", accounts: "2 accounts", meta: "1 live TOTP" },
  { domain: "vercel.com", name: "Vercel", accounts: "1 account", meta: "Sign in with GitHub" },
];

export default function HomePage() {
  const { user, authLoading } = useVault();

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Split Hero Bento */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="vault-card flex flex-col justify-between rounded-3xl p-6 sm:p-10 lg:col-span-7">
          <div className="space-y-4 sm:space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-500">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              AES-256-GCM · Authenticated by SSE Accounts
            </span>

            <h1 className="vault-text-primary text-2xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Passwords, OAuth, TOTP &amp; Security Keys — Organized by App.
            </h1>

            <p className="vault-text-secondary max-w-xl text-xs leading-relaxed sm:text-base">
              Enter any website URL and SSE Vault automatically fetches its real
              icon and segregates every account under its own app vault. Track
              OAuth logins (email-only), toggle live TOTP &amp; zero-storage{" "}
              <code>.txt</code> recovery keys, and tap used keys to cross them
              off as <code>-------</code>.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
            {authLoading ? (
              <div className="h-12 w-44 animate-pulse rounded-2xl bg-zinc-500/20" />
            ) : user ? (
              <Link
                href="/vault"
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
              >
                Open My Vault
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
              >
                <ShieldCheck className="h-4 w-4" />
                Unlock with SSE Accounts
              </Link>
            )}
          </div>
        </div>

        {/* Visual Preview Stack */}
        <div className="vault-card flex flex-col justify-between gap-4 rounded-3xl p-5 sm:p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <span className="vault-text-muted text-[10px] font-bold uppercase tracking-widest">
              Auto-Grouped App Vaults
            </span>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500">
              Domain Locked
            </span>
          </div>

          <div className="space-y-2.5">
            {PREVIEW_APPS.map((app) => (
              <div
                key={app.domain}
                className="vault-inset flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <SiteIcon
                    domainOrUrl={app.domain}
                    label={app.name}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="vault-text-primary truncate text-xs font-bold">
                      {app.name}
                    </div>
                    <div className="vault-text-muted truncate font-mono text-[10px]">
                      {app.domain}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="vault-text-secondary text-[11px] font-bold">
                    {app.accounts}
                  </div>
                  <div className="text-[10px] font-semibold text-amber-500">
                    {app.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="vault-inset flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 font-mono text-[11px]">
            <span className="truncate text-amber-500">a8f3k-92p1q</span>
            <span className="vault-text-muted shrink-0">→ tap →</span>
            <span className="vault-text-muted truncate font-bold">-----------</span>
          </div>
        </div>
      </section>

      {/* Feature Bento Strip */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="vault-card rounded-3xl p-5">
          <Globe className="mb-3 h-5 w-5 text-amber-500" />
          <h2 className="vault-text-primary text-sm font-extrabold">
            Auto Website Icons
          </h2>
          <p className="vault-text-muted mt-1 text-xs leading-relaxed">
            Type any URL and SSE Vault pulls its real icon automatically with
            instant fallback.
          </p>
        </div>

        <div className="vault-card rounded-3xl p-5">
          <FolderLock className="mb-3 h-5 w-5 text-emerald-500" />
          <h2 className="vault-text-primary text-sm font-extrabold">
            OAuth &amp; Strict App Folders
          </h2>
          <p className="vault-text-muted mt-1 text-xs leading-relaxed">
            Save password logins or email-only OAuth accounts, segregated
            strictly by root domain.
          </p>
        </div>

        <div className="vault-card rounded-3xl p-5">
          <Smartphone className="mb-3 h-5 w-5 text-cyan-500" />
          <h2 className="vault-text-primary text-sm font-extrabold">
            Live 2FA &amp; Key Recovery
          </h2>
          <p className="vault-text-muted mt-1 text-xs leading-relaxed">
            Real-time TOTP authenticator wall plus safe DB hexcode fallback if
            you ever rotate your encryption secret.
          </p>
        </div>

        <div className="vault-card rounded-3xl p-5">
          <FileText className="mb-3 h-5 w-5 text-rose-500" />
          <h2 className="vault-text-primary text-sm font-extrabold">
            Zero-Storage .txt Keys
          </h2>
          <p className="vault-text-muted mt-1 text-xs leading-relaxed">
            Parse backup codes from <code>.txt</code> in memory without storing
            the file, and tap to mask used keys as <code>-------</code>.
          </p>
        </div>
      </section>

      {/* Mobile Legal Footer Links */}
      <div className="flex items-center justify-center gap-4 text-xs md:hidden">
        <Link href="/privacy" className="vault-text-muted hover:text-amber-500">
          Privacy Policy
        </Link>
        <span className="vault-text-muted">·</span>
        <Link href="/terms" className="vault-text-muted hover:text-amber-500">
          Terms of Service
        </Link>
      </div>
    </div>
  );
}
