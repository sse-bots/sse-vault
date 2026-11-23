"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileText,
  KeyRound,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-[#101525] to-indigo-950/60 p-7 sm:p-10">
        <div className="max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/35 bg-indigo-500/15 px-3 py-1 text-xs font-bold text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by SSE Accounts SSO · AES-256-GCM
          </span>

          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Your Private Vault for TOTP &amp; Security Keys
          </h1>

          <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
            Store website logins (URL, email, username, password), generate live
            30-second TOTP codes, and import recovery keys straight from{" "}
            <code>.txt</code> files without ever storing the file — click any
            code when used to cross it off cleanly as <code>-------</code>.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            {loading ? (
              <div className="h-11 w-44 animate-pulse rounded-xl bg-slate-800/70" />
            ) : user ? (
              <Link
                href="/vault"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
              >
                Open My Vault
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
              >
                <ShieldCheck className="h-4 w-4" />
                Sign in with SSE Accounts
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
            <Smartphone className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold text-white">
            Live TOTP Authenticator
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            Paste any Base32 secret or <code>otpauth://</code> URI to get
            real-time 6-digit codes with a 30-second countdown ring and
            one-click copy.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <FileText className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold text-white">
            Zero-Storage .txt Parser
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            Upload your backup codes <code>.txt</code> file — every code is
            extracted in browser memory, encrypted individually in MongoDB, and
            the file itself is never saved.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
            <KeyRound className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold text-white">
            Click-to-Consume Keys
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            Click any security code when you use it — it copies straight to your
            clipboard and turns into <code>-------</code> matching the exact
            length of that code.
          </p>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-emerald-400" />
          <p className="text-xs text-slate-300">
            Authenticated strictly through{" "}
            <strong className="text-white">SSE Accounts</strong> (OAuth 2.1 +
            PKCE) with per-user AES-256-GCM encryption.
          </p>
        </div>
      </section>
    </div>
  );
}
