"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { generateTotpCode } from "@/lib/totp";

export function TotpLiveWidget({
  secret,
  privacyBlur = false,
  compact = false,
  onCopied,
}: {
  secret: string;
  privacyBlur?: boolean;
  compact?: boolean;
  onCopied?: (code: string) => void;
}) {
  const [code, setCode] = useState<string>("------");
  const [remaining, setRemaining] = useState<number>(30);
  const [period, setPeriod] = useState<number>(30);
  const [copied, setCopied] = useState(false);
  const [showRawSecret, setShowRawSecret] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let active = true;
    async function tick() {
      const res = await generateTotpCode(secret);
      if (!active) return;
      if (!res) {
        setInvalid(true);
        setCode("INVALID");
        return;
      }
      setInvalid(false);
      setCode(res.code);
      setRemaining(res.remaining);
      setPeriod(res.period);
    }
    tick();
    const timer = window.setInterval(tick, 500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [secret]);

  async function handleCopy() {
    if (invalid || code.includes("-")) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopied?.(code);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  const formattedCode =
    !invalid && code.length === 6
      ? `${code.slice(0, 3)} ${code.slice(3)}`
      : !invalid && code.length === 8
        ? `${code.slice(0, 4)} ${code.slice(4)}`
        : code;

  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - remaining / Math.max(1, period));
  const ringColor =
    remaining <= 5 ? "#ef4444" : remaining <= 10 ? "#f59e0b" : "#06b6d4";

  return (
    <div className="vault-inset rounded-2xl p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-500">
          <KeyRound className="h-3 w-3" />
          Live TOTP
        </span>
        {!compact && (
          <button
            type="button"
            onClick={() => setShowRawSecret((v) => !v)}
            className="vault-text-muted inline-flex items-center gap-1 text-[10px] font-semibold hover:text-amber-500"
          >
            {showRawSecret ? (
              <>
                <EyeOff className="h-3 w-3" />
                Hide Secret
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                Raw Secret
              </>
            )}
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={invalid}
        onClick={handleCopy}
        title="Tap to copy live TOTP code"
        className="vault-card flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition hover:border-cyan-500/50 disabled:opacity-60"
      >
        <span
          className={`vault-text-primary font-mono text-2xl font-black tracking-[0.18em] transition ${
            privacyBlur ? "blur-sm select-none" : ""
          }`}
        >
          {formattedCode}
        </span>

        <div className="flex items-center gap-2.5">
          {copied ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-500">
              <Check className="h-3.5 w-3.5" />
              Copied
            </span>
          ) : (
            <Copy className="vault-text-muted h-4 w-4" />
          )}

          {!invalid && (
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
              <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.14"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r={radius}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="vault-text-secondary absolute font-mono text-[10px] font-extrabold">
                {remaining}
              </span>
            </div>
          )}
        </div>
      </button>

      {showRawSecret && !compact && (
        <div className="vault-card mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
          <code className="vault-text-secondary truncate font-mono text-[11px]">
            {secret}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(secret).catch(() => {})}
            className="shrink-0 text-[11px] font-bold text-amber-500 hover:underline"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}
