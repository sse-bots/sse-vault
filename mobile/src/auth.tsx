import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as LocalAuth from "expo-local-authentication";
import { api, ApiError, setApiHandlers, tokens } from "./api";
import { API_BASE, APP_SCHEME } from "./config";
import { clearOffline, hasOffline, loadOffline, rememberPin, verifyOfflinePin } from "./offline";
import { clearAutofillData } from "./autofill";
import type { PinStatus, VaultUser } from "./types";

export type Phase = "loading" | "signedOut" | "pinSetup" | "pinReset" | "locked" | "unlocked";

const K_SESSION = "sse_session";
const K_BIO_PIN = "sse_bio_pin";
const K_BIO_ON = "sse_bio_on";

interface AuthCtx {
  phase: Phase;
  user: VaultUser | null;
  pinStatus: PinStatus | null;
  /** True when running from the encrypted offline copy (read-only). */
  offline: boolean;
  bioEnabled: boolean;
  bioAvailable: boolean;
  busy: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setupPin: (pin: string, confirm: string) => Promise<boolean>;
  unlock: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  changePin: (current: string, next: string, confirm: string) => Promise<boolean>;
  startPinReset: () => Promise<void>;
  resetPin: (next: string, confirm: string) => Promise<boolean>;
  setSecurityQuestions: (
    questions: Array<{ question: string; answer: string }>
  ) => Promise<boolean>;
  resetPinWithQuestions: (
    answers: string[],
    newPin: string,
    confirmPin: string
  ) => Promise<boolean>;
  reconnect: () => Promise<void>;
  lock: () => void;
  enableBiometrics: (pin: string) => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
  setAutoLock: (minutes: number) => Promise<void>;
  clearError: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<VaultUser | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [offline, setOffline] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const autoLockRef = useRef(30);

  const lock = useCallback(() => {
    tokens.pin = null;
    setPhase((p) => (p === "unlocked" ? "locked" : p));
  }, []);

  const resetToSignedOut = useCallback(async () => {
    tokens.session = null;
    tokens.pin = null;
    setUser(null);
    setPinStatus(null);
    setOffline(false);
    await SecureStore.deleteItemAsync(K_SESSION).catch(() => {});
    await clearOffline();
    await clearAutofillData();
    setPhase("signedOut");
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const me = await api.me();
      if (!me.authenticated || !me.user) {
        await resetToSignedOut();
        return;
      }
      setOffline(false);
      setUser(me.user);
      setPinStatus(me.pinStatus);
      autoLockRef.current = me.pinStatus?.autoLockMinutes ?? 1;
      setPhase(me.pinStatus?.canResetPin ? "pinReset" : me.pinStatus?.hasPin ? "locked" : "pinSetup");
    } catch (e) {
      // No connection: fall back to the encrypted offline copy when one exists.
      if (e instanceof ApiError && e.status === 0 && (await hasOffline())) {
        const snap = await loadOffline();
        if (snap) {
          setUser(snap.user);
          setPinStatus(snap.pinStatus);
          setOffline(true);
          setPhase("locked");
          return;
        }
      }
      setError((e as Error).message);
      setPhase("signedOut");
    }
  }, [resetToSignedOut]);

  // Boot
  useEffect(() => {
    setApiHandlers({
      onUnauthorized: () => void resetToSignedOut(),
      onLocked: () => lock(),
    });
    (async () => {
      const hw = await LocalAuth.hasHardwareAsync().catch(() => false);
      const enrolled = await LocalAuth.isEnrolledAsync().catch(() => false);
      setBioAvailable(hw && enrolled);
      setBioEnabled((await SecureStore.getItemAsync(K_BIO_ON).catch(() => null)) === "1");
      const saved = await SecureStore.getItemAsync(K_SESSION).catch(() => null);
      if (!saved) return setPhase("signedOut");
      tokens.session = saved;
      await loadMe();
    })();
  }, [loadMe, lock, resetToSignedOut]);

  // Auto-lock after time in background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") backgroundedAt.current = Date.now();
      if (s === "active" && backgroundedAt.current) {
        const mins = autoLockRef.current;
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (mins > 0 && away >= mins * 60_000) lock();
      }
    });
    return () => sub.remove();
  }, [lock]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE}/api/auth/login?mobile=1`,
        `${APP_SCHEME}://auth`
      );
      if (result.type !== "success") return;
      const m = result.url.match(/[?&]token=([^&#]+)/);
      if (!m) throw new Error("Sign-in did not return a session. Please try again.");
      const token = decodeURIComponent(m[1]);
      tokens.session = token;
      await SecureStore.setItemAsync(K_SESSION, token);
      await loadMe();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startPinReset = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE}/api/auth/login?mobile=1&pin_reset=1`,
        `${APP_SCHEME}://auth`
      );
      if (result.type !== "success") return;
      const m = result.url.match(/[?&]token=([^&#]+)/);
      if (!m) throw new Error("Re-authentication did not return a session.");
      const token = decodeURIComponent(m[1]);
      tokens.session = token;
      await SecureStore.setItemAsync(K_SESSION, token);
      const me = await api.me();
      if (me.authenticated && me.user) {
        setOffline(false);
        setUser(me.user);
        setPinStatus(me.pinStatus);
        setPhase("pinReset");
      } else {
        throw new Error("Could not verify your SSE Account session. Please try again.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetPin = (next: string, confirm: string) =>
    run(async () => {
      const res = await api.pin({ action: "reset", newPin: next, confirmPin: confirm });
      await rememberPin(next);
      if (bioEnabled) {
        await SecureStore.setItemAsync(K_BIO_PIN, next, {
          requireAuthentication: true,
          authenticationPrompt: "Update biometric unlock",
        }).catch(() => {});
      }
      applyUnlock(res);
      return true;
    });

  const setSecurityQuestions = (
    questions: Array<{ question: string; answer: string }>
  ) =>
    run(async () => {
      const res = await api.pin({
        action: "set_security_questions",
        questions,
      });
      if (res.pinStatus) setPinStatus(res.pinStatus);
      return true;
    });

  const resetPinWithQuestions = (
    answers: string[],
    newPin: string,
    confirmPin: string
  ) =>
    run(async () => {
      const res = await api.pin({
        action: "reset_via_questions",
        answers,
        newPin,
        confirmPin,
      });
      await rememberPin(newPin);
      if (bioEnabled) {
        await SecureStore.setItemAsync(K_BIO_PIN, newPin, {
          requireAuthentication: true,
          authenticationPrompt: "Update biometric unlock",
        }).catch(() => {});
      }
      applyUnlock(res);
      return true;
    });

  const signOut = async () => {
    if (!offline) await api.logout();
    await SecureStore.deleteItemAsync(K_BIO_PIN).catch(() => {});
    await SecureStore.deleteItemAsync(K_BIO_ON).catch(() => {});
    setBioEnabled(false);
    await resetToSignedOut();
  };

  const applyUnlock = (res: { pinStatus: PinStatus; pinToken?: string }) => {
    if (!res.pinToken)
      throw new ApiError("Server did not return an unlock token. Deploy the latest vault backend.", 500, null);
    tokens.pin = res.pinToken;
    setPinStatus(res.pinStatus);
    autoLockRef.current = res.pinStatus.autoLockMinutes;
    setPhase("unlocked");
  };

  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.data?.pinStatus) setPinStatus(e.data.pinStatus);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const setupPin = (pin: string, confirm: string) =>
    run(async () => {
      const res = await api.pin({ action: "setup", pin, confirmPin: confirm });
      await rememberPin(pin);
      applyUnlock(res);
      return true;
    });

  const unlock = (pin: string) =>
    run(async () => {
      if (offline) {
        const r = await verifyOfflinePin(pin);
        if (r === "ok") {
          tokens.pin = null;
          setPhase("unlocked");
          return true;
        }
        if (r === "wiped") {
          setOffline(false);
          setError("Too many wrong PINs. Offline data was erased — reconnect to unlock.");
          await loadMe();
          return false;
        }
        setError("Wrong PIN.");
        return false;
      }
      const res = await api.pin({ action: "verify", pin });
      await rememberPin(pin);
      applyUnlock(res);
      return true;
    });

  const unlockWithBiometrics = async () => {
    if (!bioEnabled) return false;
    try {
      const pin = await SecureStore.getItemAsync(K_BIO_PIN, {
        requireAuthentication: true,
        authenticationPrompt: "Unlock SSE Vault",
      });
      if (!pin) return false;
      return await unlock(pin);
    } catch {
      return false;
    }
  };

  const changePin = (current: string, next: string, confirm: string) =>
    run(async () => {
      const res = await api.pin({ action: "change", currentPin: current, newPin: next, confirmPin: confirm });
      if (res.pinToken) tokens.pin = res.pinToken;
      setPinStatus(res.pinStatus);
      await rememberPin(next);
      if (bioEnabled) {
        await SecureStore.setItemAsync(K_BIO_PIN, next, {
          requireAuthentication: true,
          authenticationPrompt: "Update biometric unlock",
        }).catch(() => {});
      }
      return true;
    });

  const reconnect = async () => {
    setBusy(true);
    setError(null);
    tokens.pin = null;
    await loadMe();
    setBusy(false);
  };

  const enableBiometrics = (pin: string) =>
    run(async () => {
      if (!offline) await api.pin({ action: "verify", pin }); // confirm the PIN before storing it
      else if ((await verifyOfflinePin(pin)) !== "ok") throw new Error("Wrong PIN.");
      await SecureStore.setItemAsync(K_BIO_PIN, pin, {
        requireAuthentication: true,
        authenticationPrompt: "Enable biometric unlock",
      });
      await SecureStore.setItemAsync(K_BIO_ON, "1");
      setBioEnabled(true);
      return true;
    });

  const disableBiometrics = async () => {
    await SecureStore.deleteItemAsync(K_BIO_PIN).catch(() => {});
    await SecureStore.deleteItemAsync(K_BIO_ON).catch(() => {});
    setBioEnabled(false);
  };

  const setAutoLock = async (minutes: number) => {
    try {
      const res = await api.pin({ action: "preferences", autoLockMinutes: minutes });
      setPinStatus(res.pinStatus);
      autoLockRef.current = res.pinStatus.autoLockMinutes;
      if (res.pinToken) tokens.pin = res.pinToken;
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Ctx.Provider
      value={{
        phase, user, pinStatus, offline, bioEnabled, bioAvailable, busy, error,
        signIn, signOut, setupPin, unlock, unlockWithBiometrics, changePin, startPinReset, resetPin, setSecurityQuestions, resetPinWithQuestions, reconnect, lock,
        enableBiometrics, disableBiometrics, setAutoLock,
        clearError: () => setError(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
