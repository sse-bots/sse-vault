"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Delete,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useVault } from "@/components/VaultContext";
import {
  isPlatformBiometricsSupported,
  unlockWithWebBiometrics,
} from "@/lib/webauthn-client";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function VaultPinGate() {
  const { user, pinStatus, setPinStatus, clearUser, showToast } = useVault();
  const isSetup = !pinStatus?.hasPin;

  const [resetMode, setResetMode] = useState(false);
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);

  const isCreatingNewPin = isSetup || resetMode;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("pin_reset") === "1") {
      setResetMode(true);
      setStep("enter");
      setFirstPin("");
      setPin("");
    }
  }, []);

  useEffect(() => {
    if (isSetup || !pinStatus?.hasWebAuthn) {
      setBioAvailable(false);
      return;
    }
    void isPlatformBiometricsSupported().then(setBioAvailable);
  }, [isSetup, pinStatus?.hasWebAuthn]);

  useEffect(() => {
    if (!pinStatus?.lockedUntil) {
      setCooldownSec(0);
      return;
    }
    const target = new Date(pinStatus.lockedUntil).getTime();
    const tick = () => setCooldownSec(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [pinStatus?.lockedUntil]);

  const submitPin = useCallback(
    async (fullSixDigits: string) => {
      if (busy || (cooldownSec > 0 && !resetMode)) return;
      setError(null);

      if (isCreatingNewPin && step === "enter") {
        setFirstPin(fullSixDigits);
        setPin("");
        setStep("confirm");
        return;
      }

      if (isCreatingNewPin && step === "confirm") {
        if (fullSixDigits !== firstPin) {
          setError("PINs did not match. Please enter your 6-digit PIN again.");
          setFirstPin("");
          setPin("");
          setStep("enter");
          return;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/vault/pin", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              resetMode
                ? { action: "reset", newPin: firstPin, confirmPin: fullSixDigits }
                : { action: "setup", pin: firstPin, confirmPin: fullSixDigits }
            ),
          });
          const j = await res.json();
          if (!res.ok) {
            setError(j.error || "Could not save Vault PIN.");
            setFirstPin("");
            setPin("");
            setStep("enter");
            if (j.requiresReauth) setResetMode(false);
            return;
          }
          if (resetMode && typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("pin_reset");
            window.history.replaceState({}, "", url.toString());
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
          showToast(resetMode ? "Vault PIN reset & unlocked!" : "6-digit Vault PIN set! Vault unlocked.");
        } catch {
          setError("Network error while saving PIN.");
          setPin("");
        } finally {
          setBusy(false);
        }
        return;
      }

      setBusy(true);
      try {
        const res = await fetch("/api/vault/pin", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", pin: fullSixDigits }),
        });
        const j = await res.json();
        if (!res.ok) {
          setError(j.error || "Incorrect 6-digit PIN.");
          if (j.lockedUntil) {
            setPinStatus(pinStatus ? { ...pinStatus, lockedUntil: j.lockedUntil } : null);
          }
          setPin("");
          return;
        }
        setPinStatus(
          j.pinStatus || {
            hasPin: true,
            unlocked: true,
            autoLockMinutes: pinStatus?.autoLockMinutes ?? 30,
            failedAttempts: 0,
            lockedUntil: null,
          }
        );
        showToast("Vault unlocked.");
      } catch {
        setError("Network error while verifying PIN.");
        setPin("");
      } finally {
        setBusy(false);
      }
    },
    [busy, cooldownSec, isCreatingNewPin, resetMode, step, firstPin, pinStatus, setPinStatus, showToast]
  );

  async function handleBiometricUnlock() {
    if (bioBusy || busy) return;
    setBioBusy(true);
    setError(null);
    try {
      const res = await unlockWithWebBiometrics();
      if (res?.pinStatus) {
        setPinStatus(res.pinStatus);
        showToast("Unlocked with Biometrics / Passkey!");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Biometric unlock failed.");
    } finally {
      setBioBusy(false);
    }
  }

  const pushDigit = useCallback(
    (d: string) => {
      if (busy || (cooldownSec > 0 && !resetMode)) return;
      setError(null);
      setPin((prev) => {
        if (prev.length >= 6) return prev;
        const next = prev + d;
        if (next.length === 6) window.setTimeout(() => void submitPin(next), 80);
        return next;
      });
    },
    [busy, cooldownSec, resetMode, submitPin]
  );

  const backspace = useCallback(() => {
    if (busy) return;
    setPin((prev) => prev.slice(0, -1));
  }, [busy]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        pushDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pushDigit, backspace]);

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    } finally {
      clearUser();
      window.location.assign("/");
    }
  }

  return (
    <div className="mx-auto flex min-h-[72vh] max-w-md flex-col items-center justify-center py-4 sm:py-8">
      <div className="vault-card w-full rounded-3xl p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/25">
            {isCreatingNewPin ? <ShieldCheck className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
          </div>
          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-500">
            {resetMode ? "SSE Verified · Reset Vault PIN" : isSetup ? "Step 2 · Mandatory Vault Lock" : "Vault Locked"}
          </span>
          <h1 className="vault-text-primary mt-2.5 text-xl font-black sm:text-2xl">
            {resetMode
              ? step === "enter" ? "Choose New 6-Digit PIN" : "Confirm New Vault PIN"
              : isSetup
                ? step === "enter" ? "Create 6-Digit Vault PIN" : "Confirm Your Vault PIN"
                : "Enter 6-Digit Vault PIN"}
          </h1>
          <p className="vault-text-muted mt-1 text-xs leading-relaxed">
            {resetMode
              ? "SSE Accounts re-authentication succeeded. Enter a new 6-digit PIN to unlock your vault."
              : isSetup
                ? step === "enter"
                  ? "Set a private 6-digit PIN required every time you open your passwords, TOTP codes, and security keys."
                  : "Re-enter the same 6 digits to lock in your Vault PIN."
                : `Signed in as ${user?.email || user?.name}. Enter your PIN to decrypt your vault.`}
          </p>
        </div>

        <div className="mb-5 flex items-center justify-center gap-3">
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const filled = idx < pin.length;
            const active = idx === pin.length;
            return (
              <div
                key={idx}
                className={`flex h-11 w-10 items-center justify-center rounded-2xl border-2 transition-all sm:h-12 sm:w-11 ${
                  error
                    ? "border-rose-500/70 bg-rose-500/10"
                    : filled
                      ? "border-amber-500 bg-amber-500/15"
                      : active
                        ? "border-amber-500/60 vault-inset"
                        : "vault-inset"
                }`}
              >
                <span className={`h-3 w-3 rounded-full transition-transform ${filled ? "scale-100 bg-amber-500" : "scale-50 bg-zinc-500/30"}`} />
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-center text-xs font-medium text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {cooldownSec > 0 && !resetMode && (
          <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-center font-mono text-xs font-bold text-amber-500">
            Locked for {cooldownSec}s after too many failed attempts
          </div>
        )}

        {(busy || bioBusy) && (
          <div className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold text-amber-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {bioBusy ? "Verifying Biometrics..." : isCreatingNewPin ? "Securing your vault..." : "Verifying PIN..."}
          </div>
        )}

        {!isCreatingNewPin && bioAvailable && (
          <button
            type="button"
            disabled={busy || bioBusy}
            onClick={handleBiometricUnlock}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 py-3 text-xs font-extrabold text-emerald-500 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Fingerprint className="h-4 w-4" />
            Unlock with Biometrics / Passkey
          </button>
        )}

        <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2.5">
          {DIGITS.map((d) => (
            <button
              key={d}
              type="button"
              disabled={busy || (cooldownSec > 0 && !resetMode)}
              onClick={() => pushDigit(d)}
              className="vault-inset vault-text-primary flex h-13 items-center justify-center rounded-2xl text-lg font-extrabold transition hover:border-amber-500/70 active:scale-95 disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            disabled={busy || pin.length === 0}
            onClick={() => setPin("")}
            className="vault-inset vault-text-muted flex h-13 items-center justify-center rounded-2xl text-[11px] font-bold transition hover:text-amber-500 active:scale-95 disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={busy || (cooldownSec > 0 && !resetMode)}
            onClick={() => pushDigit("0")}
            className="vault-inset vault-text-primary flex h-13 items-center justify-center rounded-2xl text-lg font-extrabold transition hover:border-amber-500/70 active:scale-95 disabled:opacity-40"
          >
            0
          </button>
          <button
            type="button"
            disabled={busy || pin.length === 0}
            onClick={backspace}
            aria-label="Backspace"
            className="vault-inset vault-text-muted flex h-13 items-center justify-center rounded-2xl transition hover:text-amber-500 active:scale-95 disabled:opacity-40"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        <div className="vault-divider mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs">
          {isCreatingNewPin && step === "confirm" ? (
            <button
              type="button"
              onClick={() => {
                setStep("enter");
                setFirstPin("");
                setPin("");
                setError(null);
              }}
              className="font-semibold text-amber-500 hover:underline"
            >
              ← Start over
            </button>
          ) : !isCreatingNewPin ? (
            <a
              href="/api/auth/login?next=/vault&pin_reset=1"
              className="inline-flex items-center gap-1 font-bold text-amber-500 hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Forgot PIN?
            </a>
          ) : (
            <span className="vault-text-muted inline-flex items-center gap-1 text-[11px]">
              <KeyRound className="h-3.5 w-3.5 text-amber-500" />
              Keyboard 0–9 works
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="vault-text-muted inline-flex items-center gap-1 font-semibold hover:text-rose-500"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
