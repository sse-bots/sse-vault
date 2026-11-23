"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2, Lock, Shield } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { useAuth } from "@/components/AuthContext";

const ACCOUNTS_URL = (
  process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL || "https://sse-account.vercel.app"
).replace(/\/+$/, "");

function SignInInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/vault";

  useEffect(() => {
    const err = searchParams.get("error");
    const desc = searchParams.get("error_description");
    if (err) {
      setError(desc || `Sign-in failed: ${err.replace(/_/g, " ")}`);
    }
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
    <div className="mx-auto mt-10 max-w-md">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-7 shadow-2xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white">Sign in to SSE Vault</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Unlock your encrypted passwords, live TOTP authenticators, and
            backup security keys using your central{" "}
            <strong className="text-white">SSE Account</strong>.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleSseSignIn}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Shield className="h-4 w-4" />
          )}
          Continue with SSE Accounts
        </button>

        <div className="mt-4 text-center">
          <a
            href={`${ACCOUNTS_URL}/sign-up`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:underline"
          >
            Don&apos;t have an SSE Account? Create one
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-400">Loading...</div>
      }
    >
      <SignInInner />
    </Suspense>
  );
}
