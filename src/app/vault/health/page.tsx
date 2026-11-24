"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Lock,
  LogIn,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";
import { SiteIcon } from "@/components/SiteIcon";
import { evaluatePasswordStrength } from "@/lib/domain";
import type { VaultItemDTO } from "@/lib/vault-types";

export default function VaultHealthPage() {
  const { user, authLoading, items } = useVault();

  const audit = useMemo(() => {
    const weakPasswords: VaultItemDTO[] = [];
    const missingTotp: VaultItemDTO[] = [];
    const lowKeys: Array<{ item: VaultItemDTO; left: number; total: number }> = [];
    const passwordMap = new Map<string, VaultItemDTO[]>();

    for (const item of items) {
      if (item.password) {
        const st = evaluatePasswordStrength(item.password);
        if (st.score <= 2) weakPasswords.push(item);

        const list = passwordMap.get(item.password) || [];
        list.push(item);
        passwordMap.set(item.password, list);
      }

      if (!item.totpSecret) {
        missingTotp.push(item);
      }

      if (item.securityCodes.length > 0) {
        const left = item.securityCodes.filter((c) => !c.used).length;
        if (left <= 2) {
          lowKeys.push({ item, left, total: item.securityCodes.length });
        }
      }
    }

    const reusedGroups = Array.from(passwordMap.values()).filter(
      (group) => group.length > 1
    );
    const reusedCount = reusedGroups.reduce((s, g) => s + g.length, 0);

    // Score calculation (0-100)
    let score = 100;
    if (items.length > 0) {
      score -= weakPasswords.length * 14;
      score -= reusedGroups.length * 16;
      score -= Math.min(25, missingTotp.length * 5);
      score -= lowKeys.length * 8;
      score = Math.max(10, Math.min(100, score));
    }

    return {
      score,
      weakPasswords,
      reusedGroups,
      reusedCount,
      missingTotp,
      lowKeys,
    };
  }, [items]);

  if (authLoading) {
    return (
      <div className="vault-text-muted py-20 text-center text-sm">
        Running security check...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="vault-card mx-auto mt-12 max-w-md rounded-3xl p-8 text-center">
        <Lock className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <Link
          href="/sign-in?next=/vault/health"
          className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-zinc-950"
        >
          <LogIn className="h-4 w-4" />
          Sign in with SSE Accounts
        </Link>
      </div>
    );
  }

  const scoreColor =
    audit.score >= 80
      ? "#10b981"
      : audit.score >= 55
        ? "#f59e0b"
        : "#ef4444";

  const radius = 32;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - audit.score / 100);

  return (
    <div className="space-y-6">
      {/* Health Score Banner */}
      <section className="vault-card flex flex-col justify-between gap-6 rounded-3xl p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 76 76">
              <circle
                cx="38"
                cy="38"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.14"
                strokeWidth="6"
              />
              <circle
                cx="38"
                cy="38"
                r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                className="transition-all duration-700"
              />
            </svg>
            <span className="vault-text-primary absolute text-base font-black">
              {audit.score}%
            </span>
          </div>

          <div>
            <h1 className="vault-text-primary text-2xl font-black">
              Vault Security Check
            </h1>
            <p className="vault-text-muted mt-1 text-xs">
              Audited {items.length} account(s) for weak passwords, password
              reuse, missing 2FA, and depleted recovery keys.
            </p>
          </div>
        </div>

        <a
          href="/api/vault/export"
          className="vault-inset vault-text-primary inline-flex items-center justify-center gap-2 self-start rounded-2xl px-4 py-2.5 text-xs font-bold transition hover:border-amber-500 sm:self-center"
        >
          <Download className="h-4 w-4 text-amber-500" />
          Export JSON Backup
        </a>
      </section>

      {/* 4 Summary Counters */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="vault-card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-500">
            <ShieldAlert className="h-3.5 w-3.5" />
            Weak Passwords
          </div>
          <div className="vault-text-primary mt-1 text-2xl font-black">
            {audit.weakPasswords.length}
          </div>
        </div>

        <div className="vault-card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
            <Copy className="h-3.5 w-3.5" />
            Reused Passwords
          </div>
          <div className="vault-text-primary mt-1 text-2xl font-black">
            {audit.reusedCount}
          </div>
        </div>

        <div className="vault-card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-500">
            <Smartphone className="h-3.5 w-3.5" />
            No TOTP Setup
          </div>
          <div className="vault-text-primary mt-1 text-2xl font-black">
            {audit.missingTotp.length}
          </div>
        </div>

        <div className="vault-card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-500">
            <KeyRound className="h-3.5 w-3.5" />
            Low Backup Keys
          </div>
          <div className="vault-text-primary mt-1 text-2xl font-black">
            {audit.lowKeys.length}
          </div>
        </div>
      </section>

      {/* Detailed Findings */}
      {audit.weakPasswords.length === 0 &&
      audit.reusedGroups.length === 0 &&
      audit.lowKeys.length === 0 ? (
        <div className="vault-card rounded-3xl p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <h2 className="vault-text-primary text-base font-extrabold">
            No Critical Security Issues Found!
          </h2>
          <p className="vault-text-muted mt-1 text-xs">
            All saved passwords are strong, unique, and your backup keys are
            healthy.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {audit.weakPasswords.length > 0 && (
            <section className="vault-card space-y-3 rounded-3xl p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-rose-500">
                <AlertTriangle className="h-4 w-4" />
                Weak or Fair Passwords ({audit.weakPasswords.length})
              </div>
              <div className="space-y-2">
                {audit.weakPasswords.map((item) => (
                  <Link
                    key={item.id}
                    href={`/vault/${encodeURIComponent(item.domainKey)}`}
                    className="vault-inset flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 hover:border-amber-500"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SiteIcon
                        domainOrUrl={item.domainKey}
                        label={item.appName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="vault-text-primary truncate text-xs font-bold">
                          {item.appName}
                        </div>
                        <div className="vault-text-muted truncate font-mono text-[11px]">
                          {item.email || item.username || item.label}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-500">
                      Strengthen
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {audit.reusedGroups.length > 0 && (
            <section className="vault-card space-y-3 rounded-3xl p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-amber-500">
                <Copy className="h-4 w-4" />
                Reused Passwords Detected ({audit.reusedGroups.length} group
                {audit.reusedGroups.length === 1 ? "" : "s"})
              </div>
              <div className="space-y-3">
                {audit.reusedGroups.map((grp, idx) => (
                  <div
                    key={idx}
                    className="vault-inset space-y-1.5 rounded-2xl p-3"
                  >
                    <div className="vault-text-muted text-[10px] font-bold uppercase tracking-wider">
                      Shared across {grp.length} accounts
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {grp.map((item) => (
                        <Link
                          key={item.id}
                          href={`/vault/${encodeURIComponent(item.domainKey)}`}
                          className="vault-card inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold hover:border-amber-500"
                        >
                          <SiteIcon
                            domainOrUrl={item.domainKey}
                            label={item.appName}
                            size="sm"
                          />
                          <span className="vault-text-primary">
                            {item.appName}
                          </span>
                          <span className="vault-text-muted font-mono text-[10px]">
                            ({item.email || item.username || item.label})
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {audit.lowKeys.length > 0 && (
            <section className="vault-card space-y-3 rounded-3xl p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-orange-500">
                <ShieldCheck className="h-4 w-4" />
                Low Remaining Backup Security Keys ({audit.lowKeys.length})
              </div>
              <div className="space-y-2">
                {audit.lowKeys.map(({ item, left, total }) => (
                  <Link
                    key={item.id}
                    href={`/vault/${encodeURIComponent(item.domainKey)}`}
                    className="vault-inset flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 hover:border-amber-500"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SiteIcon
                        domainOrUrl={item.domainKey}
                        label={item.appName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="vault-text-primary truncate text-xs font-bold">
                          {item.appName} ({left}/{total} left)
                        </div>
                        <div className="vault-text-muted truncate font-mono text-[11px]">
                          {item.email || item.username || item.label}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-500">
                      Import .txt
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
