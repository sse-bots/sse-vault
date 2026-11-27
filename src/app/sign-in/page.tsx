"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import {
  Download,
  ExternalLink,
  KeyRound,
  LogIn,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";

const ACCOUNTS_URL = (
  process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL || "https://sse-account.vercel.app"
).replace(/\/+$/, "");

function SignInInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, authLoading } = useVault();
  const [isNative, setIsNative] = useState(false);

  const error =
    searchParams.get("error_description") || searchParams.get("error");
  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/vault";

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(safeNext);
    }
  }, [authLoading, user, router, safeNext]);

  return (
    <div className="mx-auto mt-6 max-w-md sm:mt-10">
      <div className="vault-card overflow-hidden rounded-3xl shadow-2xl">
        {/* Hero Header */}
        <div className="vault-divider vault-inset border-b px-6 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/25">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="vault-text-primary mt-4 text-2xl font-black">
            Sign in to SSE Vault
          </h1>
          <p className="vault-text-muted mt-1.5 text-xs leading-relaxed">
            Authenticate securely with your centralized{" "}
            <strong className="vault-text-primary">SSE Account</strong> to
            unlock your passwords, linked OAuth accounts, live TOTP codes, and
            recovery keys.
          </p>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Direct full navigation to /api/auth/login (Tournament-style PKCE OAuth) */}
          <a
            href={`/api/auth/login?next=${encodeURIComponent(safeNext)}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3.5 text-sm font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
          >
            <LogIn className="h-4 w-4" />
            Continue with SSE Accounts
          </a>

          <div className="vault-inset rounded-2xl p-4 text-[11px] leading-relaxed">
            <div className="vault-text-primary flex items-center gap-1.5 font-bold">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Fast &amp; Stateless SSE SSO
            </div>
            <p className="vault-text-muted mt-1">
              Uses encrypted PKCE session cookies directly from{" "}
              <a
                href={ACCOUNTS_URL}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-amber-500 underline"
              >
                SSE Accounts
              </a>{" "}
              with your mandatory 6-digit Vault PIN protecting every entry.
            </p>
          </div>

          <div className="text-center">
            <a
              href={`${ACCOUNTS_URL}/sign-up`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:underline"
            >
              Need an SSE Account? Create one
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <p className="vault-text-muted pt-1 text-center text-[11px]">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-amber-500 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-amber-500 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>

      {!isNative && (
        <Link
          href="/apk"
          className="vault-card-interactive mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Smartphone className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="vault-text-primary text-xs font-extrabold">
                Use SSE Vault on Android
              </div>
              <div className="vault-text-muted truncate text-[11px]">
                Download the official Android APK
              </div>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-extrabold text-zinc-950">
            <Download className="h-3.5 w-3.5" />
            APK
          </span>
        </Link>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="vault-text-muted py-20 text-center text-sm">
          Loading...
        </div>
      }
    >
      <SignInInner />
    </Suspense>
  );
}
