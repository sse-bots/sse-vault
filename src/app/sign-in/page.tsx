"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Download, ExternalLink, KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { useVault } from "@/components/VaultContext";

const ACCOUNTS_URL = (
  process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL || "https://sse-account.vercel.app"
).replace(/\/+$/, "");

function SignInInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, authLoading } = useVault();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/vault";

  useEffect(() => {
    const err = searchParams.get("error");
    const desc = searchParams.get("error_description");
    if (err) setError(desc || `Sign-in failed: ${err.replace(/_/g, " ")}`);
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(safeNext);
    }
  }, [authLoading, user, router, safeNext]);

  async function handleSseSignIn() {
    setLoading(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const res = await signIn.social({
        provider: "sse",
        callbackURL: `${origin}${safeNext}`,
        errorCallbackURL: `${origin}/sign-in`,
      });
      if (res?.error) {
        setError(res.error.message || "Could not start SSE Accounts sign-in.");
        setLoading(false);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start SSE Accounts sign-in."
      );
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-md sm:mt-12">
      <div className="vault-card rounded-3xl p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/25">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="vault-text-primary text-2xl font-black">
            Unlock SSE Vault
          </h1>
          <p className="vault-text-muted mt-2 text-xs leading-relaxed">
            Sign in with your central{" "}
            <strong className="vault-text-primary">SSE Account</strong> to
            access your encrypted passwords, OAuth logins, live TOTP codes, and
            backup security keys.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleSseSignIn}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Continue with SSE Accounts
        </button>

        <div className="mt-5 text-center">
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

        <p className="vault-text-muted mt-6 text-center text-[11px]">
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
