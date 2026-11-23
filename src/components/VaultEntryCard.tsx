"use client";

import { useRef, useState } from "react";
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  Star,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { TotpLiveWidget } from "@/components/TotpLiveWidget";
import { extractSecurityCodesFromText } from "@/lib/parse-codes";
import type { VaultItemDTO, VaultSecurityCodeDTO } from "@/lib/vault-types";

interface VaultEntryCardProps {
  item: VaultItemDTO;
  privacyBlur: boolean;
  onEdit: (item: VaultItemDTO) => void;
  onUpdated: (item: VaultItemDTO) => void;
  onDeleted: (id: string) => void;
}

export function VaultEntryCard({
  item,
  privacyBlur,
  onEdit,
  onUpdated,
  onDeleted,
}: VaultEntryCardProps) {
  const quickTxtRef = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [busyCodeId, setBusyCodeId] = useState<string | null>(null);
  const [uploadingTxt, setUploadingTxt] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cardNotice, setCardNotice] = useState<string | null>(null);

  const unusedCount = item.securityCodes.filter((c) => !c.used).length;
  const totalCodes = item.securityCodes.length;

  function flashNotice(msg: string) {
    setCardNotice(msg);
    window.setTimeout(() => {
      setCardNotice((prev) => (prev === msg ? null : prev));
    }, 2600);
  }

  async function copyText(key: string, val: string) {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(key);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === key ? null : prev));
      }, 1500);
    } catch {
      // ignore
    }
  }

  async function toggleFavorite() {
    const res = await fetch(`/api/vault/${item.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !item.favorite }),
    });
    if (res.ok) {
      const j = await res.json();
      if (j.item) onUpdated(j.item);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Permanently delete "${item.label}" and all its encrypted TOTP & recovery keys?`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/vault/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) onDeleted(item.id);
    } finally {
      setDeleting(false);
    }
  }

  /**
   * Clicking an unused security code:
   *  1. Copies the plaintext code to clipboard immediately so you can paste it.
   *  2. Persists `used: true` to MongoDB so it turns into `-------` (exact length!).
   */
  async function handleUseCode(codeObj: VaultSecurityCodeDTO) {
    if (codeObj.used || busyCodeId) return;

    if (codeObj.code) {
      await navigator.clipboard.writeText(codeObj.code).catch(() => {});
    }

    setBusyCodeId(codeObj.id);
    try {
      const res = await fetch(`/api/vault/${item.id}/codes`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          codeId: codeObj.id,
          used: true,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.item) onUpdated(j.item);
        flashNotice("Code copied & marked as used!");
      }
    } finally {
      setBusyCodeId(null);
    }
  }

  async function handleRestoreCode(codeObj: VaultSecurityCodeDTO) {
    if (!codeObj.used || busyCodeId) return;
    setBusyCodeId(codeObj.id);
    try {
      const res = await fetch(`/api/vault/${item.id}/codes`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          codeId: codeObj.id,
          used: false,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.item) onUpdated(j.item);
        flashNotice("Code restored.");
      }
    } finally {
      setBusyCodeId(null);
    }
  }

  async function handleQuickTxtImport(file: File) {
    setUploadingTxt(true);
    try {
      const text = await file.text();
      const codes = extractSecurityCodesFromText(text);
      if (codes.length === 0) {
        flashNotice("No security codes found in that .txt file.");
        return;
      }
      const res = await fetch(`/api/vault/${item.id}/codes`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "append", codes }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.item) onUpdated(j.item);
        flashNotice(`Added ${codes.length} code(s) from .txt (file not stored).`);
      }
    } finally {
      setUploadingTxt(false);
      if (quickTxtRef.current) quickTxtRef.current.value = "";
    }
  }

  const displayHost = (() => {
    try {
      return new URL(item.url).hostname.replace(/^www\./i, "");
    } catch {
      return item.url;
    }
  })();

  return (
    <article className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-indigo-500/45">
      <div className="space-y-4">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-extrabold uppercase text-white shadow-md shadow-indigo-500/20">
              {item.label.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-base font-bold text-white">
                  {item.label}
                </h3>
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1 truncate text-xs text-indigo-400 hover:underline"
              >
                <span className="truncate">{displayHost}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={toggleFavorite}
              title={item.favorite ? "Unpin favorite" : "Pin favorite"}
              className={`rounded-xl p-2 transition hover:bg-slate-800 ${
                item.favorite ? "text-amber-400" : "text-slate-500 hover:text-white"
              }`}
            >
              <Star
                className="h-4 w-4"
                fill={item.favorite ? "currentColor" : "none"}
              />
            </button>
            <button
              type="button"
              onClick={() => onEdit(item)}
              title="Edit entry"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              title="Delete entry"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Credentials (Email, Username, Password) */}
        {(item.email || item.username || item.password) && (
          <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
            {item.email && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span
                    className={`truncate font-mono text-slate-200 ${
                      privacyBlur ? "blur-sm select-none" : ""
                    }`}
                  >
                    {item.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText("email", item.email!)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  title="Copy email"
                >
                  {copiedField === "email" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}

            {item.username && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <User className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span
                    className={`truncate font-mono text-slate-200 ${
                      privacyBlur ? "blur-sm select-none" : ""
                    }`}
                  >
                    {item.username}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyText("username", item.username!)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  title="Copy username"
                >
                  {copiedField === "username" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}

            {item.password && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span
                    className={`truncate font-mono text-slate-200 ${
                      privacyBlur ? "blur-sm select-none" : ""
                    }`}
                  >
                    {showPassword ? item.password : "••••••••••••"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                    title={showPassword ? "Hide password" : "Reveal password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText("password", item.password!)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                    title="Copy password"
                  >
                    {copiedField === "password" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live TOTP Authenticator */}
        {item.totpSecret && (
          <TotpLiveWidget secret={item.totpSecret} privacyBlur={privacyBlur} />
        )}

        {/* Security / Backup Codes Section */}
        <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Security Keys
              </span>
              {totalCodes > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    unusedCount === 0
                      ? "bg-rose-500/15 text-rose-300"
                      : unusedCount <= 2
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {unusedCount}/{totalCodes} left
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={uploadingTxt}
              onClick={() => quickTxtRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:border-indigo-500 hover:text-white disabled:opacity-50"
            >
              {uploadingTxt ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              Import .txt
            </button>
            <input
              ref={quickTxtRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleQuickTxtImport(f);
              }}
            />
          </div>

          {cardNotice && (
            <div className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300">
              {cardNotice}
            </div>
          )}

          {totalCodes === 0 ? (
            <p className="text-[11px] text-slate-500">
              No backup security keys yet. Upload a <code>.txt</code> file to
              parse &amp; store codes automatically.
            </p>
          ) : (
            <>
              <p className="text-[10px] text-slate-500">
                Click any code to copy &amp; mark it used (turns into{" "}
                <code>-------</code> matching its exact length).
              </p>

              <div className="grid grid-cols-2 gap-1.5">
                {item.securityCodes.map((c) => {
                  const isBusy = busyCodeId === c.id;
                  if (c.used) {
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/40 px-2.5 py-2"
                        title={
                          c.usedAt
                            ? `Used on ${new Date(c.usedAt).toLocaleString()}`
                            : "Used security code"
                        }
                      >
                        <span className="truncate font-mono text-xs font-bold tracking-wider text-slate-500 select-none">
                          {c.masked}
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleRestoreCode(c)}
                          title="Undo / restore code"
                          className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-indigo-400"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleUseCode(c)}
                      title="Click to copy & mark as used (-------)"
                      className="group flex items-center justify-between gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-2 text-left transition hover:border-indigo-500 hover:bg-indigo-500/10 disabled:opacity-50"
                    >
                      <span
                        className={`truncate font-mono text-xs font-semibold text-indigo-300 group-hover:text-white ${
                          privacyBlur ? "blur-sm select-none" : ""
                        }`}
                      >
                        {c.code || c.masked}
                      </span>
                      {isBusy ? (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-indigo-400" />
                      ) : (
                        <Copy className="h-3 w-3 shrink-0 text-slate-500 opacity-60 transition group-hover:text-indigo-400 group-hover:opacity-100" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {item.notes && (
          <p
            className={`rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400 ${
              privacyBlur ? "blur-sm select-none" : ""
            }`}
          >
            {item.notes}
          </p>
        )}
      </div>
    </article>
  );
}
