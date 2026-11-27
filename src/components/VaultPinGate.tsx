"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Delete,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";

export function VaultPinGate() {
  const { user, pinStatus, setPinStatus, clearUser, showToast } = useVault();
  const isSetup = !pinStatus?.hasPin;

  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  // Live cooldown ticker if brute-force lockout is active
  useEffect(() => {
    if (!pinStatus?.lockedUntil) {
      setCooldownSec(0);
      return;
    }
    const target = new Date(pinStatus.lockedUntil).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setCooldownSec(diff);
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [pinStatus?.lockedUntil]);

  function triggerError(msg: string) {
    setError(msg);
    setShake(true);
    setPin("");
    window.setTimeout(() => setShake(false), 380);
  }

  const submitCode = useCallback(
    async (fullSixDigits: string) => {
      if (busy || cooldownSec > 0) return;

      // First-time setup: Step 1 -> Step 2 Confirmation
      if (isSetup && step === "enter") {
        setFirstPin(fullSixDigits);
        setPin("");
        setError(null);
        setStep("confirm");
        return;
      }

      if (isSetup && step === "confirm") {
        if (fullSixDigits !== firstPin) {
          triggerError("PINs did not match. Enter your 6-digit PIN again.");
          setStep("enter");
          setFirstPin("");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/vault/pin", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "setup",
              pin: firstPin,
              confirmPin: fullSixDigits,
            }),
          });
          const j = await res.json();
          if (!res.ok) {
            triggerError(j.error || "Could not create 6-digit PIN.");
            setStep("enter");
            setFirstPin("");
            return;
          }
          setPinStatus(
            j.pinStatus || {
              hasPin: true,
              unlocked: true,
              autoLockMinutes: 30,
              failedAttempts: 0,
              lockedUntil: null,
            }
          );
          showToast("6-digit Vault PIN created & unlocked!");
        } catch {
          triggerError("Network error while creating PIN.");
        } finally {
          setBusy(false);
        }
        return;
      }

      // Standard Unlock Verification
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/vault/pin", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", pin: fullSixDigits }),
        });
        const j = await res.json();
        if (!res.ok) {
          if (j.lockedUntil) {
            setPinStatus(
              pinStatus
                ? { ...pinStatus, lockedUntil: j.lockedUntil }
                : null
            );
          }
          triggerError(j.error || "Incorrect 6-digit PIN.");
          return;
        }
        setPinStatus(
          j.pinStatus || {
            hasPin: true,
            unlocked: true,
            autoLockMinutes: 30,
            failedAttempts: 0,
            lockedUntil: null,
          }
        );
        showToast("Vault unlocked.");
      } catch {
        triggerError("Network error while verifying PIN.");
      } finally {
        setBusy(false);
      }
    },
    [busy, cooldownSec, isSetup, step, firstPin, pinStatus, setPinStatus, showToast]
  );

  const pushDigit = useCallback(
    (digit: string) => {
      if (busy || cooldownSec > 0) return;
      if (!/^\d$/.test(digit)) return;
      setError(null);
      setPin((prev) => {
        if (prev.length >= 6) return prev;
        const next = prev + digit;
        if (next.length === 6) {
          window.setTimeout(() => submitCode(next), 80);
        }
        return next;
      });
    },
    [busy, cooldownSec, submitCode]
  );

  const popDigit = useCallback(() => {
    if (busy) return;
    setPin((prev) => prev.slice(0, -1));
  }, [busy]);

  // Support physical keyboard typing 0–9 and Backspace anywhere on the PIN screen
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        pushDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        popDigit();
      } else if (e.key === "Escape") {
        setPin("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pushDigit, popDigit]);

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    } finally {
      clearUser();
      window.location.assign("/");
    }
  }

  return (
    <div className="mx-auto flex min-h-[72vh] max-w-md flex-col items-center justify-center py-4">
      <div className="vault-card w-full rounded-3xl p-6 shadow-2xl sm:p-8">
        {/* Top Icon + Status */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/25">
            {isSetup ? (
              <ShieldCheck className="h-7 w-7" />
            ) : (
              <Lock className="h-7 w-7" />
            )}
          </div>

          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-500">
            {isSetup
              ? step === "enter"
                ? "Step 1 of 2 · Required"
                : "Step 2 of 2 · Confirm"
              : "6-Digit Vault Lock"}
          </span>

          <h1 className="vault-text-primary mt-2.5 text-xl font-black sm:text-2xl">
            {isSetup
              ? step === "enter"
                ? "Create 6-Digit Vault PIN"
                : "Confirm Your 6-Digit PIN"
              : "Enter 6-Digit Vault PIN"}
          </h1>

          <p className="vault-text-muted mt-1 text-xs leading-relaxed">
            {isSetup
              ? step === "enter"
                ? "Choose a 6-digit numeric PIN. You must enter this PIN every time before accessing any vault page."
                : "Re-enter the same 6 digits to lock and protect your SSE Vault."
              : `Signed in as ${user?.email || "SSE User"}. Enter your 6-digit PIN to unlock your passwords & keys.`}
          </p>
        </div>

        {/* 6-Digit Tactile Indicator Slots */}
        <div
          className={`my-6 flex items-center justify-center gap-2 sm:gap-2.5 ${
            shake ? "animate-pin-shake" : ""
          }`}
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const filled = idx < pin.length;
            const active = idx === pin.length && !busy && cooldownSec === 0;
            return (
              <div
                key={idx}
                className={`flex h-12 w-10 items-center justify-center rounded-xl border-2 transition-all sm:h-13 sm:w-11 sm:rounded-2xl ${
                  error
                    ? "border-rose-500/70 bg-rose-500/10"
                    : filled
                      ? "border-amber-500 bg-amber-500/15"
                      : active
                        ? "border-amber-500/70 bg-amber-500/5"
                        : "vault-inset"
                }`}
              >
                {filled ? (
                  <span className="animate-pin-pop h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.75)]" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500/35" />
                )}
              </div>
            );
          })}
        </div>

        {busy && (
          <div className="mb-4 flex items-center justify-center gap-2 text-xs font-bold text-amber-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isSetup ? "Securing your vault..." : "Verifying PIN..."}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-center text-xs font-semibold text-rose-400">
            {error}
          </div>
        )}

        {cooldownSec > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-center font-mono text-xs font-bold text-amber-500">
            Locked for {cooldownSec}s after multiple failed attempts
          </div>
        )}

        {/* Tactile On-Screen Numeric Keypad (Works Great on Mobile + Desktop Click) */}
        <div className="mx-auto grid max-w-[270px] grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              disabled={busy || cooldownSec > 0}
              onClick={() => pushDigit(d)}
              className="vault-inset vault-text-primary flex h-13 items-center justify-center rounded-2xl text-xl font-black transition hover:border-amber-500/60 hover:text-amber-500 active:scale-95 disabled:opacity-40"
            >
              {d}
            </button>
          ))}

          <button
            type="button"
            disabled={busy || pin.length === 0}
            onClick={() => {
              setPin("");
              setError(null);
            }}
            className="vault-inset vault-text-muted flex h-13 items-center justify-center rounded-2xl text-xs font-bold uppercase tracking-wider transition hover:text-amber-500 active:scale-95 disabled:opacity-40"
          >
            Clear
          </button>

          <button
            type="button"
            disabled={busy || cooldownSec > 0}
            onClick={() => pushDigit("0")}
            className="vault-inset vault-text-primary flex h-13 items-center justify-center rounded-2xl text-xl font-black transition hover:border-amber-500/60 hover:text-amber-500 active:scale-95 disabled:opacity-40"
          >
            0
          </button>

          <button
            type="button"
            disabled={busy || pin.length === 0}
            onClick={popDigit}
            aria-label="Backspace"
            className="vault-inset vault-text-secondary flex h-13 items-center justify-center rounded-2xl transition hover:text-rose-500 active:scale-95 disabled:opacity-40"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {/* Footer Controls */}
        <div className="vault-divider mt-6 flex items-center justify-between gap-2 border-t pt-4 text-xs">
          {isSetup && step === "confirm" ? (
            <button
              type="button"
              onClick={() => {
                setStep("enter");
                setFirstPin("");
                setPin("");
                setError(null);
              }}
              className="vault-text-muted inline-flex items-center gap-1 font-bold hover:text-amber-500"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Change PIN
            </button>
          ) : (
            <span className="vault-text-muted inline-flex items-center gap-1.5 text-[11px]">
              <KeyRound className="h-3.5 w-3.5 text-amber-500" />
              Keyboard or Keypad
            </span>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1 font-bold text-rose-500 hover:underline"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
