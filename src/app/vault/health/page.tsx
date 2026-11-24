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
import { KeyRecoveryBanner } from "@/components/KeyRecoveryBanner";
import { evaluatePasswordStrength } from "@/lib/domain";
import type { VaultItemDTO } from "@/lib/vault-types";

export default function VaultHealthPage() {
  const { user, authLoading, items, lockedCount, recoveredCount } = useVault();

  const audit = useMemo(() => {
    const weakPasswords: VaultItemDTO[] = [];
    const missingTotp: VaultItemDTO[] = [];
    const lowKeys: Array<{ item: VaultItemDTO; left: number; total: number }> =
      [];
    const passwordMap = new Map<string, VaultItemDTO[]>();
    let oauthCount = 0;

    for (const item of items) {
      if (item.authType === "oauth") {
        oauthCount += 1;
      } else if (item.password) {
        const st = evaluatePasswordStrength(item.password);
        if (st.score <= 2) weakPasswords.push(item);

        const list = passwordMap.get(item.password) || [];
        list.push(item);
        passwordMap.set(item.password, list);
      }

      if (item.authType === "password" && !item.totpSecret && !item.hasPasskey) {
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

    let score = 100;
    if (items.length > 0) {
      score -= weakPasswords.length * 14;
      score -= reusedGroups.length * 16;
      score -= Math.min(25, missingTotp.length * 5);
      score -= lowKeys.length * 8;
      score -= lockedCount * 12;
      score = Math.max(10, Math.min(100, score));
    }

    return {
      score,
      oauthCount,
      weakPasswords,
      reusedGroups,
      reusedCount,
      missingTotp,
      lowKeys,
    };
  }, [items, lockedCount]);

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
    audit.score >= 80 ? "#10b981" : audit.score >= 55 ? "#f59e0b" : "#ef4444";

  const radius = 30;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - audit.score / 100);

  return (
    <div className="space-y-5 sm:space-y-6">
      <KeyRecoveryBanner />

      {/* Mobile-Safe Health Score Banner */}
      <section className="vault-card flex flex-col justify-between gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <div className="relative flex h-18 w-18 shrink-0 items-center justify-center sm:h-20 sm:w-20">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72">
              <circle
                cx="36"
                cy="36"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.14"
                strokeWidth="6"
              />
              <circle
                cx="36"
                cy="36"
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
            <span className="vault-text-primary absolute text-sm font-black sm:text-base">
              {audit.score}%
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="vault-text-primary text-xl font-black sm:text-2xl">
              Vault Security Check
            </h1>
            <p className="vault-text-muted mt-1 text-xs leading-relaxed">
              Audited {items.length} account(s) ({audit.oauthCount} OAuth) for
              weak or reused passwords, missing 2FA, and low recovery keys.
            </p>
          </div>
        </div>

        <a
          href="/api/vault/export"
          className="vault-inset vault-text-primary inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition hover:border-amber-500 sm:w-auto"
        >
          <Download className="h-4 w-4 text-amber-500" />
          Export JSON Backup
        </a>
      </section>

      {/* 4 Mobile-Safe Summary Counters */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <div className="vault-card min-w-0 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-500">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Weak Pass</span>
          </div>
          <div className="vault-text-primary mt-1 text-xl font-black sm:text-2xl">
            {audit.weakPasswords.length}
          </div>
        </div>

        <div className="vault-card min-w-0 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
            <Copy className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Reused</span>
          </div>
          <div className="vault-text-primary mt-1 text-xl font-black sm:text-2xl">
            {audit.reusedCount}
          </div>
        </div>

        <div className="vault-card min-w-0 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-500">
            <Smartphone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">No 2FA</span>
          </div>
          <div className="vault-text-primary mt-1 text-xl font-black sm:text-2xl">
            {audit.missingTotp.length}
          </div>
        </div>

        <div className="vault-card min-w-0 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-500">
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Low Keys</span>
          </div>
          <div className="vault-text-primary mt-1 text-xl font-black sm:text-2xl">
            {audit.lowKeys.length}
          </div>
        </div>
      </section>

      {/* Findings */}
      {audit.weakPasswords.length === 0 &&
      audit.reusedGroups.length === 0 &&
      audit.lowKeys.length === 0 &&
      lockedCount === 0 &&
      recoveredCount === 0 ? (
        <div className="vault-card rounded-3xl p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <h2 className="vault-text-primary text-base font-extrabold">
            No Critical Security Issues Found!
          </h2>
          <p className="vault-text-muted mt-1 text-xs">
            All password logins are strong and unique, OAuth accounts are
            cleanly tracked, and your backup keys are healthy.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Weak Passwords */}
          {audit.weakPasswords.length > 0 && (
            <section className="vault-card space-y-3 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-rose-500">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Weak or Fair Passwords ({audit.weakPasswords.length})
                </span>
              </div>
              <div className="space-y-2">
                {audit.weakPasswords.map((item) => (
                  <Link
                    key={item.id}
                    href={`/vault/${encodeURIComponent(item.domainKey)}`}
                    className="vault-inset flex min-w-0 items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 hover:border-amber-500"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <SiteIcon
                        domainOrUrl={item.domainKey}
                        label={item.appName}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="vault-text-primary truncate text-xs font-bold">
                          {item.appName}
                        </div>
                        <div className="vault-text-muted truncate font-mono text-[11px]">
                          {item.email || item.username || item.label}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-500">
                      <span className="hidden sm:inline">Strengthen</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Reused Passwords (Mobile-Fixed Grid!) */}
          {audit.reusedGroups.length > 0 && (
            <section className="vault-card space-y-3 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-amber-500">
                <Copy className="h-4 w-4 shrink-0" />
                <span>
                  Reused Passwords ({audit.reusedGroups.length}{" "}
                  {audit.reusedGroups.length === 1 ? "group" : "groups"})
                </span>
              </div>
              <div className="space-y-3">
                {audit.reusedGroups.map((grp, idx) => (
                  <div
                    key={idx}
                    className="vault-inset space-y-2 rounded-2xl p-3"
                  >
                    <div className="vault-text-muted text-[10px] font-bold uppercase tracking-wider">
                      Same password shared across {grp.length} accounts
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {grp.map((item) => (
                        <Link
                          key={item.id}
                          href={`/vault/${encodeURIComponent(item.domainKey)}`}
                          className="vault-card flex min-w-0 items-center justify-between gap-2.5 rounded-xl p-2.5 hover:border-amber-500"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <SiteIcon
                              domainOrUrl={item.domainKey}
                              label={item.appName}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="vault-text-primary truncate text-xs font-bold">
                                {item.appName}
                              </div>
                              <div className="vault-text-muted truncate font-mono text-[10px]">
                                {item.email || item.username || item.label}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="vault-text-muted h-3.5 w-3.5 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Low Backup Keys */}
          {audit.lowKeys.length > 0 && (
            <section className="vault-card space-y-3 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-extrabold text-orange-500">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>
                  Low Remaining Security Keys ({audit.lowKeys.length})
                </span>
              </div>
              <div className="space-y-2">
                {audit.lowKeys.map(({ item, left, total }) => (
                  <Link
                    key={item.id}
                    href={`/vault/${encodeURIComponent(item.domainKey)}`}
                    className="vault-inset flex min-w-0 items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 hover:border-amber-500"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <SiteIcon
                        domainOrUrl={item.domainKey}
                        label={item.appName}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="vault-text-primary truncate text-xs font-bold">
                          {item.appName}{" "}
                          <span className="text-orange-500">
                            ({left}/{total} left)
                          </span>
                        </div>
                        <div className="vault-text-muted truncate font-mono text-[11px]">
                          {item.email || item.username || item.label}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-500">
                      <span className="hidden sm:inline">Import .txt</span>
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
