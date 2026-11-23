"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
  User,
  X,
} from "lucide-react";
import { extractSecurityCodesFromText } from "@/lib/parse-codes";
import { TotpLiveWidget } from "@/components/TotpLiveWidget";
import type { VaultItemDTO } from "@/lib/vault-types";

interface VaultItemModalProps {
  initialItem?: VaultItemDTO | null;
  onClose: () => void;
  onSaved: (item: VaultItemDTO) => void;
}

function generateStrongPassword(len = 20): string {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_";
  const arr = new Uint32Array(len);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export function VaultItemModal({
  initialItem,
  onClose,
  onSaved,
}: VaultItemModalProps) {
  const isEdit = Boolean(initialItem);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [url, setUrl] = useState(initialItem?.url || "");
  const [label, setLabel] = useState(initialItem?.label || "");
  const [email, setEmail] = useState(initialItem?.email || "");
  const [username, setUsername] = useState(initialItem?.username || "");
  const [password, setPassword] = useState(initialItem?.password || "");
  const [showPassword, setShowPassword] = useState(false);
  const [totpSecret, setTotpSecret] = useState(initialItem?.totpSecret || "");
  const [notes, setNotes] = useState(initialItem?.notes || "");
  const [favorite, setFavorite] = useState(Boolean(initialItem?.favorite));

  // Security codes parsed from .txt or entered manually (never storing the file!)
  const [codesMode, setCodesMode] = useState<"keep" | "append" | "replace">(
    isEdit ? "keep" : "replace"
  );
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [fileFeedback, setFileFeedback] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function processTxtFile(file: File) {
    setError(null);
    if (file.size > 512 * 1024) {
      setError("Please select a plain .txt file smaller than 512 KB.");
      return;
    }
    try {
      // Read purely in browser RAM — file is NEVER sent to the server or stored
      const text = await file.text();
      const extracted = extractSecurityCodesFromText(text);
      if (extracted.length === 0) {
        setError(
          `No security codes could be detected inside "${file.name}". Try pasting them below.`
        );
        return;
      }

      setParsedCodes((prev) => Array.from(new Set([...prev, ...extracted])));
      if (isEdit && codesMode === "keep") {
        setCodesMode("append");
      }
      setFileFeedback(
        `Extracted ${extracted.length} security code(s) from "${file.name}" in memory — file discarded and never stored.`
      );
    } catch {
      setError("Could not read that .txt file.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleAddManualCodes() {
    const extracted = extractSecurityCodesFromText(manualCodeInput);
    if (extracted.length === 0) return;
    setParsedCodes((prev) => Array.from(new Set([...prev, ...extracted])));
    if (isEdit && codesMode === "keep") {
      setCodesMode("append");
    }
    setManualCodeInput("");
  }

  function removeParsedCode(code: string) {
    setParsedCodes((prev) => prev.filter((c) => c !== code));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const endpoint = isEdit ? `/api/vault/${initialItem!.id}` : "/api/vault";
      const method = isEdit ? "PATCH" : "POST";

      const payload = isEdit
        ? {
            label,
            url,
            email,
            username,
            password,
            totpSecret,
            notes,
            favorite,
            securityCodesMode: parsedCodes.length > 0 ? codesMode : "keep",
            securityCodes: parsedCodes.length > 0 ? parsedCodes : undefined,
          }
        : {
            label,
            url,
            email,
            username,
            password,
            totpSecret,
            securityCodes: parsedCodes,
            notes,
            favorite,
          };

      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not save vault entry.");
        setSaving(false);
        return;
      }
      if (j.item) onSaved(j.item);
      onClose();
    } catch {
      setError("Network error while saving vault entry.");
      setSaving(false);
    }
  }

  return (
    <div className="animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="animate-sheet-up max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-slate-700 bg-[#0b1120] p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEdit ? `Edit ${initialItem?.label}` : "Add Vault Entry"}
              </h2>
              <p className="text-[11px] text-slate-400">
                All passwords, TOTP secrets &amp; recovery codes are AES-256-GCM
                encrypted.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* 1. Website URL & Optional Custom Title */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Website URL *
              </label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Service Name (optional — auto from URL)
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. GitHub, Discord, Google"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 2. Email & Username (Either or Both) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Email (optional)
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Username (optional — use email, username, or both)
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. sseofficial"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Password */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setPassword(generateStrongPassword(20));
                  setShowPassword(true);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Generate Strong
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Account password"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-10 font-mono text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-2 rounded-lg p-1 text-slate-400 hover:text-white"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* 4. TOTP Secret + Live Preview */}
          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                TOTP Secret Key or <code>otpauth://</code> URI (optional)
              </label>
              <input
                value={totpSecret}
                onChange={(e) => setTotpSecret(e.target.value)}
                placeholder="e.g. JBSWY3DPEHPK3PXP or otpauth://totp/..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {totpSecret.trim().length >= 8 && (
              <TotpLiveWidget secret={totpSecret} compact />
            )}
          </div>

          {/* 5. Security / Backup Keys (.txt Upload — In-Memory Only, Never Stored!) */}
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  Security / Backup Codes (.txt Importer)
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Upload any backup codes <code>.txt</code> file — codes are
                  separated in memory and fed straight to the server.{" "}
                  <strong className="text-emerald-400">
                    The file is never stored.
                  </strong>
                </p>
              </div>
              {isEdit && initialItem && initialItem.securityCodes.length > 0 && (
                <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1 text-[10px] font-bold">
                  {(["keep", "append", "replace"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCodesMode(m)}
                      className={`rounded-lg px-2 py-1 capitalize ${
                        codesMode === m
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Drag-and-Drop .txt Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) processTxtFile(dropped);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
                isDragging
                  ? "border-indigo-500 bg-indigo-500/15"
                  : "border-slate-700 bg-slate-900/50 hover:border-indigo-500/70"
              }`}
            >
              <Upload className="mb-2 h-6 w-6 text-indigo-400" />
              <div className="text-xs font-bold text-white">
                Tap to Upload <code>.txt</code> Backup Codes File
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                Supports GitHub, Discord, Google, SSE Accounts &amp; plain code
                lists
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processTxtFile(f);
                }}
              />
            </div>

            {fileFeedback && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{fileFeedback}</span>
              </div>
            )}

            {/* Manual Code Entry */}
            <div className="flex gap-2">
              <input
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddManualCodes();
                  }
                }}
                placeholder="Or paste / type security code(s) manually..."
                className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddManualCodes}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:border-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            {/* Extracted Codes Preview */}
            {parsedCodes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-300">
                    Ready to Encrypt &amp; Save ({parsedCodes.length} codes):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedCodes([]);
                      setFileFeedback(null);
                    }}
                    className="text-rose-400 hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
                  {parsedCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-indigo-300"
                    >
                      <span>{code}</span>
                      <button
                        type="button"
                        onClick={() => removeParsedCode(code)}
                        className="text-slate-500 hover:text-rose-400"
                        title="Remove code"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. Notes & Favorite */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Notes (optional — encrypted)
              </label>
              <textarea
                rows={2}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra recovery notes..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              Pin this account to top (Favorite)
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {isEdit ? "Save Changes" : "Encrypt & Save to Vault"}
          </button>
        </div>
      </form>
    </div>
  );
}
