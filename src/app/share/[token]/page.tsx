"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Flame, KeyRound, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

interface SharedSecretData {
  appName: string;
  label: string;
  url: string;
  entryType?: string;
  authType: string;
  oauthProvider?: string | null;
  email?: string | null;
  username?: string | null;
  password?: string | null;
  cardDetails?: {
    cardholderName?: string;
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    billingZip?: string;
  } | null;
  customFields?: Array<{ label: string; value: string }>;
  notes?: string | null;
}

export default function ShareSecretPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ title: string; expiresAt: string } | null>(null);
  const [secret, setSecret] = useState<SharedSecretData | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/share/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || !j.exists) {
          setError(j.error || "This one-time secret has expired or was already viewed.");
          return;
        }
        setMeta({ title: j.title, expiresAt: j.expiresAt });
      })
      .catch(() => setError("Could not load shared secret."))
      .finally(() => setLoading(false));
  }, [token]);

  async function revealOnce() {
    setRevealing(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${encodeURIComponent(token)}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.secret) {
        setError(j.error || "This secret has already been destroyed.");
        return;
      }
      setSecret(j.secret);
    } catch {
      setError("Network error while revealing secret.");
    } finally {
      setRevealing(false);
    }
  }

  async function copy(key: string, val: string) {
    await navigator.clipboard.writeText(val);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1500);
  }

  if (loading) {
    return (
      <div className="vault-text-muted py-24 text-center text-sm">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-amber-500" />
        Checking secret link...
      </div>
    );
  }

  if (error) {
    return (
      <div className="vault-card mx-auto mt-10 max-w-md rounded-3xl p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-500" />
        <h1 className="vault-text-primary text-lg font-extrabold">Secret Unavailable</h1>
        <p className="vault-text-muted mt-2 text-xs">{error}</p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950"
        >
          Open SSE Vault
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-lg">
      <div className="vault-card space-y-5 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500">
              SSE Vault · One-Time Secret
            </p>
            <h1 className="vault-text-primary text-lg font-black">
              {secret ? secret.label || secret.appName : meta?.title}
            </h1>
          </div>
        </div>

        {!secret ? (
          <>
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-500">
              <Flame className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                You can view this secret <strong>only once</strong>. As soon as you reveal it, it is permanently deleted from the server.
              </span>
            </div>
            <button
              type="button"
              disabled={revealing}
              onClick={revealOnce}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 text-sm font-extrabold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {revealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Reveal Secret Once
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-500">
              Secret revealed &amp; permanently deleted from SSE Vault servers. Copy what you need before closing this tab.
            </div>
            <div className="vault-inset divide-y rounded-2xl">
              {secret.url && !secret.url.includes(".local") && (
                <ShareRow label="Website" value={secret.url} copied={copiedKey === "url"} onCopy={() => copy("url", secret.url)} />
              )}
              {secret.email && (
                <ShareRow label="Email" value={secret.email} copied={copiedKey === "email"} onCopy={() => copy("email", secret.email!)} />
              )}
              {secret.username && (
                <ShareRow label="Username" value={secret.username} copied={copiedKey === "username"} onCopy={() => copy("username", secret.username!)} />
              )}
              {secret.password && (
                <ShareRow label="Password" value={secret.password} copied={copiedKey === "password"} onCopy={() => copy("password", secret.password!)} />
              )}
              {secret.cardDetails?.cardNumber && (
                <ShareRow label="Card Number" value={secret.cardDetails.cardNumber} copied={copiedKey === "card"} onCopy={() => copy("card", secret.cardDetails!.cardNumber!)} />
              )}
              {secret.cardDetails?.expiry && (
                <ShareRow label="Expiry / CVV" value={`${secret.cardDetails.expiry} · CVV ${secret.cardDetails.cvv || "—"}`} copied={copiedKey === "cvv"} onCopy={() => copy("cvv", secret.cardDetails!.cvv || "")} />
              )}
              {(secret.customFields || []).map((cf, i) => (
                <ShareRow key={i} label={cf.label} value={cf.value} copied={copiedKey === `cf_${i}`} onCopy={() => copy(`cf_${i}`, cf.value)} />
              ))}
              {secret.notes && (
                <ShareRow label="Notes" value={secret.notes} copied={copiedKey === "notes"} onCopy={() => copy("notes", secret.notes!)} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShareRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="vault-divider flex items-center justify-between gap-3 px-4 py-3 text-xs">
      <div className="min-w-0">
        <div className="vault-text-muted text-[10px] font-bold uppercase tracking-wider">{label}</div>
        <div className="vault-text-primary mt-0.5 break-all font-mono font-semibold">{value}</div>
      </div>
      <button type="button" onClick={onCopy} className="vault-card vault-text-muted shrink-0 rounded-xl p-2 hover:text-amber-500">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
