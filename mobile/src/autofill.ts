import { NativeModules, Platform } from "react-native";
import type { VaultItem } from "./types";

interface SseAutofillNative {
  isSupported(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  openSettings(): Promise<boolean>;
  getPrefs(): Promise<{ syncEnabled: boolean; requireAuth: boolean; count: number }>;
  setPrefs(syncEnabled: boolean, requireAuth: boolean): Promise<boolean>;
  syncEntries(entriesJson: string): Promise<number>;
  clearEntries(): Promise<boolean>;
  getPendingSaves(): Promise<string>;
  clearPendingSaves(): Promise<boolean>;
}

export interface AutofillStatus {
  supported: boolean;
  enabled: boolean;
  syncEnabled: boolean;
  requireAuth: boolean;
  syncedCount: number;
}

export interface PendingAutofillSave {
  webDomain: string;
  packageName: string;
  username: string;
  password: string;
  savedAt: number;
}

const nativeMod: SseAutofillNative | null =
  Platform.OS === "android" && NativeModules?.SseAutofill
    ? (NativeModules.SseAutofill as SseAutofillNative)
    : null;

export async function getAutofillStatus(): Promise<AutofillStatus> {
  if (!nativeMod) {
    return {
      supported: false,
      enabled: false,
      syncEnabled: false,
      requireAuth: true,
      syncedCount: 0,
    };
  }
  try {
    const [supported, enabled, prefs] = await Promise.all([
      nativeMod.isSupported(),
      nativeMod.isEnabled(),
      nativeMod.getPrefs(),
    ]);
    return {
      supported: Boolean(supported),
      enabled: Boolean(enabled),
      syncEnabled: Boolean(prefs?.syncEnabled),
      requireAuth: Boolean(prefs?.requireAuth),
      syncedCount: Number(prefs?.count || 0),
    };
  } catch {
    return {
      supported: false,
      enabled: false,
      syncEnabled: false,
      requireAuth: true,
      syncedCount: 0,
    };
  }
}

export async function openAndroidAutofillSettings(): Promise<boolean> {
  if (!nativeMod) return false;
  try {
    return await nativeMod.openSettings();
  } catch {
    return false;
  }
}

export async function setAutofillPrefs(
  syncEnabled: boolean,
  requireAuth: boolean
): Promise<boolean> {
  if (!nativeMod) return false;
  try {
    return await nativeMod.setPrefs(syncEnabled, requireAuth);
  } catch {
    return false;
  }
}

/**
 * Encrypts and syncs active Login items into Android KeyStore-backed Autofill storage.
 */
export async function syncVaultToAutofill(items: VaultItem[]): Promise<number> {
  if (!nativeMod) return 0;
  try {
    const payload = items
      .filter((i) => (i.entryType || "login") === "login")
      .map((i) => ({
        id: i.id,
        domainKey: i.domainKey || "",
        appName: i.appName || "",
        label: i.label || "",
        email: i.email || "",
        username: i.username || "",
        password: i.password || "",
        authType: i.authType || "password",
        oauthProvider: i.oauthProvider || "",
      }));
    return await nativeMod.syncEntries(JSON.stringify(payload));
  } catch {
    return 0;
  }
}

export async function clearAutofillData(): Promise<void> {
  if (!nativeMod) return;
  try {
    await nativeMod.clearEntries();
    await nativeMod.clearPendingSaves();
  } catch {
    /* ignore */
  }
}

export async function loadPendingAutofillSaves(): Promise<PendingAutofillSave[]> {
  if (!nativeMod) return [];
  try {
    const raw = await nativeMod.getPendingSaves();
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return (parsed as PendingAutofillSave[]).filter(
      (x) => Boolean(x && (x.username || x.password))
    );
  } catch {
    return [];
  }
}

export async function clearPendingAutofillSaves(): Promise<void> {
  if (!nativeMod) return;
  try {
    await nativeMod.clearPendingSaves();
  } catch {
    /* ignore */
  }
}
