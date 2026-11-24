"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { SiteIcon } from "@/components/SiteIcon";
import {
  parsePasswordImportFile,
  type ParsedImportEntry,
} from "@/lib/import-parser";

interface PreviewRow {
  index: number;
  domainKey: string;
  appName: string;
  identity: string;
  authType: "password" | "oauth";
  status: "new" | "exact_duplicate" | "conflict" | "invalid";
  reason: string;
  hasTotp: boolean;
  codesCount: number;
}

interface PreviewSummary {
  total: number;
  newCount: number;
  exactDuplicateCount: number;
  conflictCount: number;
  invalidCount: number;
}

export function VaultImportExportModal() {
  const {
    importExportModal,
    closeImportExportModal,
    openImportExportModal,
    refreshVault,
    showToast,
    items,
  } = useVault();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const tab = importExportModal.tab;

  const [isDragging, setIsDragging] = useState(false);
  const [checking, setChecking] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [skippedMalformed, setSkippedMalformed] = useState(0);
  const [parsedEntries, setParsedEntries] = useState<ParsedImportEntry[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<
    "skip" | "update" | "duplicate"
  >("skip");
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  if (!importExportModal.open) return null;

  function resetImport() {
    setFileName(null);
    setDetectedFormat(null);
    setSkippedMalformed(0);
    setParsedEntries([]);
    setPreviewRows([]);
    setSummary(null);
    setError(null);
    setResultMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFileSelected(file: File) {
    setError(null);
    setResultMsg(null);
    if (file.size > 4 * 1024 * 1024) {
      setError("File too large. Maximum supported import size is 4 MB.");
      return;
    }

    setChecking(true);
    try {
      // Read purely in browser memory — file is never uploaded to disk
      const text = await file.text();
      const parsed = parsePasswordImportFile(file.name, text);
      if (parsed.entries.length === 0) {
        setError("No valid password entries were found in that file.");
        return;
      }

      const capped = parsed.entries.slice(0, 500);

      // Run server-side duplicate check (preview mode) against the user's decrypted vault
      const res = await fetch("/api/vault/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "preview",
          conflictStrategy,
          entries: capped,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not inspect import file against vault.");
        return;
      }

      setFileName(file.name);
      setDetectedFormat(parsed.detectedFormat);
      setSkippedMalformed(parsed.skippedMalformed);
      setParsedEntries(capped);
      setPreviewRows(j.rows || []);
      setSummary(j.summary || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to read import file."
      );
    } finally {
      setChecking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleCommitImport() {
    if (parsedEntries.length === 0) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vault/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          conflictStrategy,
          entries: parsedEntries,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Import failed.");
        return;
      }

      await refreshVault();
      const msg = `Imported ${j.importedCount} new, updated ${j.updatedCount}, skipped ${j.skippedCount} already present.`;
      setResultMsg(msg);
      showToast(msg);
      setParsedEntries([]);
      setPreviewRows([]);
      setSummary(null);
    } catch {
      setError("Network error while importing passwords.");
    } finally {
      setCommitting(false);
    }
  }

  const actionableCount = summary
    ? summary.newCount +
      (conflictStrategy === "skip" ? 0 : summary.conflictCount)
    : 0;

  return (
    <div className="animate-vault-fade fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-vault-modal vault-card flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="vault-divider flex shrink-0 items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
          <div>
            <h2 className="vault-text-primary text-base font-extrabold sm:text-lg">
              Import &amp; Export Passwords
            </h2>
            <p className="vault-text-muted text-[11px]">
              Migrate from Chrome, Firefox, Bitwarden, Safari/iCloud, or SSE
              Vault with automatic duplicate checking.
            </p>
          </div>
          <button
            type="button"
            onClick={closeImportExportModal}
            className="vault-inset vault-text-muted shrink-0 rounded-xl p-2 hover:text-amber-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="vault-divider shrink-0 border-b px-4 py-3 sm:px-6">
          <div className="vault-inset grid grid-cols-2 gap-1.5 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => openImportExportModal("import")}
              className={`inline-flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-extrabold transition ${
                tab === "import"
                  ? "bg-amber-500 text-zinc-950"
                  : "vault-text-secondary hover:text-amber-500"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              Import Passwords
            </button>
            <button
              type="button"
              onClick={() => openImportExportModal("export")}
              className={`inline-flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-extrabold transition ${
                tab === "export"
                  ? "bg-amber-500 text-zinc-950"
                  : "vault-text-secondary hover:text-amber-500"
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              Export Vault ({items.length})
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resultMsg && (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-500">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{resultMsg}</span>
            </div>
          )}

          {tab === "import" ? (
            <div className="space-y-4">
              {!summary ? (
                <>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleFileSelected(f);
                    }}
                    onClick={() => fileRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-7 text-center transition ${
                      isDragging
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-zinc-500/30 hover:border-amber-500/70"
                    }`}
                  >
                    {checking ? (
                      <>
                        <Loader2 className="mb-2.5 h-8 w-8 animate-spin text-amber-500" />
                        <div className="vault-text-primary text-sm font-extrabold">
                          Scanning &amp; Checking Existing Vault Entries...
                        </div>
                        <p className="vault-text-muted mt-1 text-xs">
                          Comparing every URL, email, username &amp; password
                          against your saved vault.
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="mb-2.5 h-8 w-8 text-amber-500" />
                        <div className="vault-text-primary text-sm font-extrabold">
                          Tap or Drop Password Export (<code>.csv</code> or{" "}
                          <code>.json</code>)
                        </div>
                        <p className="vault-text-muted mt-1 max-w-md text-xs">
                          Supports Google Chrome, Edge, Brave, Firefox, Apple
                          iCloud/Safari, Bitwarden, 1Password, and SSE Vault
                          backups. Automatically checks if data is already
                          present before importing.
                        </p>
                      </>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,.json,text/csv,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelected(f);
                      }}
                    />
                  </div>

                  <div className="vault-inset flex items-start gap-2.5 rounded-2xl p-3.5 text-[11px]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="vault-text-secondary leading-relaxed">
                      <strong>Zero-Storage Import:</strong> Your CSV/JSON file
                      is parsed in browser memory and never stored on the
                      server. Every imported entry is auto-segregated into its
                      root website folder (e.g. Google, GitHub) and encrypted
                      with AES-256-GCM.
                    </span>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* File & Format Header */}
                  <div className="vault-inset flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-xs">
                    <div className="min-w-0">
                      <div className="vault-text-primary truncate font-bold">
                        {fileName}
                      </div>
                      <div className="vault-text-muted text-[11px]">
                        Detected: <strong>{detectedFormat}</strong>
                        {skippedMalformed > 0
                          ? ` · ${skippedMalformed} blank/non-URL row(s) ignored`
                          : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetImport}
                      className="text-xs font-bold text-amber-500 hover:underline"
                    >
                      Choose Another File
                    </button>
                  </div>

                  {/* Duplicate Check Breakdown */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="vault-card rounded-2xl border-emerald-500/35 p-3 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                        New
                      </div>
                      <div className="vault-text-primary mt-0.5 text-xl font-black">
                        {summary.newCount}
                      </div>
                    </div>
                    <div className="vault-card rounded-2xl p-3 text-center">
                      <div className="vault-text-muted text-[10px] font-bold uppercase tracking-wider">
                        Already Present
                      </div>
                      <div className="vault-text-primary mt-0.5 text-xl font-black">
                        {summary.exactDuplicateCount}
                      </div>
                    </div>
                    <div className="vault-card rounded-2xl border-amber-500/35 p-3 text-center">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                        Conflicts
                      </div>
                      <div className="vault-text-primary mt-0.5 text-xl font-black">
                        {summary.conflictCount}
                      </div>
                    </div>
                  </div>

                  {/* Conflict Resolution Option (only if conflicts found) */}
                  {summary.conflictCount > 0 && (
                    <div className="vault-inset space-y-2 rounded-2xl p-3.5 text-xs">
                      <div className="vault-text-primary font-bold">
                        {summary.conflictCount} account(s) already exist with a
                        different password or TOTP:
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: "skip", label: "Skip Existing" },
                            { id: "update", label: "Update Existing" },
                            { id: "duplicate", label: "Import as New" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setConflictStrategy(opt.id)}
                            className={`rounded-xl border px-2.5 py-2 text-[11px] font-bold transition ${
                              conflictStrategy === opt.id
                                ? "border-amber-500 bg-amber-500 text-zinc-950"
                                : "vault-card vault-text-secondary"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-Row Preview List */}
                  <div className="vault-inset max-h-60 space-y-1.5 overflow-y-auto rounded-2xl p-2.5">
                    {previewRows.map((r) => (
                      <div
                        key={r.index}
                        className="vault-card flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <SiteIcon
                            domainOrUrl={r.domainKey}
                            label={r.appName}
                            size="sm"
                            className="!h-7 !w-7 !rounded-lg"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="vault-text-primary truncate font-bold">
                              {r.appName}{" "}
                              <span className="vault-text-muted font-mono text-[10px] font-normal">
                                ({r.identity})
                              </span>
                            </div>
                            <div className="vault-text-muted truncate text-[10px]">
                              {r.reason}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                            r.status === "new"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : r.status === "exact_duplicate"
                                ? "bg-zinc-500/20 text-zinc-400"
                                : r.status === "conflict"
                                  ? "bg-amber-500/15 text-amber-500"
                                  : "bg-rose-500/15 text-rose-500"
                          }`}
                        >
                          {r.status === "new"
                            ? "New"
                            : r.status === "exact_duplicate"
                              ? "Exists"
                              : r.status === "conflict"
                                ? "Differs"
                                : "Invalid"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* EXPORT TAB */
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="vault-inset flex flex-col justify-between gap-4 rounded-2xl p-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-amber-500">
                    <FileJson className="h-5 w-5" />
                    SSE Vault JSON (.json)
                  </div>
                  <p className="vault-text-muted text-xs leading-relaxed">
                    Complete full-fidelity backup including passwords, OAuth
                    providers, TOTP secrets, backup security keys (with used
                    status), categories, passkeys, and notes.
                  </p>
                </div>
                <a
                  href="/api/vault/export?format=json"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-zinc-950 hover:bg-amber-400"
                >
                  <Download className="h-4 w-4" />
                  Download Full JSON
                </a>
              </div>

              <div className="vault-inset flex flex-col justify-between gap-4 rounded-2xl p-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-cyan-500">
                    <FileSpreadsheet className="h-5 w-5" />
                    Universal CSV (.csv)
                  </div>
                  <p className="vault-text-muted text-xs leading-relaxed">
                    Standard spreadsheet format compatible with Google Chrome,
                    Edge, Bitwarden, Firefox, and Apple Passwords (includes URL,
                    username, email, password, TOTP &amp; notes).
                  </p>
                </div>
                <a
                  href="/api/vault/export?format=csv"
                  className="vault-card vault-text-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold hover:border-cyan-500 hover:text-cyan-500"
                >
                  <Download className="h-4 w-4" />
                  Download Universal CSV
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="vault-divider flex shrink-0 items-center justify-end gap-2.5 border-t px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={closeImportExportModal}
            className="vault-inset vault-text-secondary rounded-xl px-4 py-2 text-xs font-semibold"
          >
            Close
          </button>

          {tab === "import" && summary && (
            <button
              type="button"
              disabled={committing || actionableCount === 0}
              onClick={handleCommitImport}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-xs font-extrabold text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50"
            >
              {committing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {actionableCount === 0
                ? "All Entries Already Present"
                : `Import ${actionableCount} Entry${actionableCount === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
