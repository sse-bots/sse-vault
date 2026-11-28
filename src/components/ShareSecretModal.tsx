"use client";

import { useState } from "react";
import { Check, Clock, Copy, Flame, Loader2, Share2, X } from "lucide-react";
import { useVault } from "@/components/VaultContext";

export function ShareSecretModal({
  itemId,
  itemTitle,
  onClose,
}: {
  itemId: string;
  itemTitle: string;
  onClose: () => void;
}) {
  const { showToast } = useVault();
  const [expiry, setExpiry] = useState<"10" | "60" | "1440">("60");
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vault/share", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, expiresMinutes: expiry }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not create one-time link.");
        return;
      }
      setShareUrl(j.url);
    } catch {
      setError("Network error while creating share link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showToast("One-time share link copied!");
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="animate-vault-fade fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="animate-vault-modal vault-card w-full max-w-md space-y-4 rounded-3xl p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="vault-text-primary text-sm font-extrabold">
                One-Time Secret Link
              </h3>
              <p className="vault-text-muted truncate text-[11px]">{itemTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="vault-inset vault-text-muted rounded-xl p-1.5 hover:text-amber-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3 text-[11px] text-amber-500">
          <Flame className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Self-destructs immediately after the recipient clicks{" "}
            <strong>Reveal Secret</strong> once, or when the timer expires.
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-400">
            {error}
          </div>
        )}

        {!shareUrl ? (
          <div className="space-y-3">
            <div>
              <label className="vault-text-secondary mb-1.5 flex items-center gap-1 text-xs font-bold">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Expires After
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "10", label: "10 mins" },
                    { id: "60", label: "1 hour" },
                    { id: "1440", label: "24 hours" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExpiry(opt.id)}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition ${
                      expiry === opt.id
                        ? "border-amber-500 bg-amber-500/15 text-amber-500"
                        : "vault-inset vault-text-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-xs font-extrabold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Generate One-Time Link
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="vault-inset break-all rounded-2xl p-3 font-mono text-[11px] text-amber-500">
              {shareUrl}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-xs font-extrabold text-zinc-950 hover:bg-amber-400"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied to Clipboard" : "Copy One-Time Link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
