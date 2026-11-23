"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Smartphone } from "lucide-react";
import { generateTotpCode } from "@/lib/totp";

export function TotpLiveWidget({
  secret,
  privacyBlur = false,
  compact = false,
}: {
  secret: string;
  privacyBlur?: boolean;
  compact?: boolean;
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

  async function copyCode() {
    if (invalid || code.includes("-")) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore clipboard errors
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
    remaining <= 4 ? "#f43f5e" : remaining <= 8 ? "#f59e0b" : "var(--accent-500)";

  return (
    <div className="rounded-2xl border border-indigo-500/35 bg-slate-950/80 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
          <Smartphone className="h-3.5 w-3.5" />
          Live TOTP Code
        </span>

        {!compact && (
          <button
            type="button"
            onClick={() => setShowRawSecret((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-white"
          >
            {showRawSecret ? (
              <>
                <EyeOff className="h-3 w-3" />
                Hide Secret
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                Show Secret
              </>
            )}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={copyCode}
        disabled={invalid}
        title="Click to copy TOTP code"
        className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-left transition hover:border-indigo-500 disabled:opacity-60"
      >
        <span
          className={`font-mono text-2xl font-extrabold tracking-widest text-white transition ${
            privacyBlur ? "blur-sm select-none" : ""
          }`}
        >
          {formattedCode}
        </span>

        <div className="flex items-center gap-2.5">
          {copied ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-300">
              <Check className="h-3.5 w-3.5" />
              Copied
            </span>
          ) : (
            <Copy className="h-4 w-4 text-slate-400" />
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
                  strokeOpacity="0.16"
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
              <span className="absolute font-mono text-[10px] font-bold text-slate-300">
                {remaining}
              </span>
            </div>
          )}
        </div>
      </button>

      {showRawSecret && !compact && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
          <code className="truncate font-mono text-[11px] text-slate-300">
            {secret}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(secret).catch(() => {})}
            className="shrink-0 text-[11px] font-semibold text-indigo-400 hover:underline"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}
