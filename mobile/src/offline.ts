// Encrypted offline copy of the vault.
//  - Data is encrypted with AES-256-CTR + HMAC-SHA256 (encrypt-then-MAC).
//  - The random encryption key lives in the Android Keystore via SecureStore.
//  - Offline unlock checks the Vault PIN against a salted, iterated hash kept in SecureStore.
//  - 10 wrong PINs offline wipes the cache.
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import aesjs from "aes-js";
import { hmacSha256, sha256 } from "./totp";
import type { PinStatus, VaultItem, VaultUser } from "./types";

const FILE = `${FileSystem.documentDirectory}vault-cache.json`;
const K_KEY = "sse_cache_key";
const K_VER = "sse_pin_verifier";
const K_FAILS = "sse_offline_fails";
const K_ON = "sse_offline_on";
const MAX_FAILS = 10;
const ITERATIONS = 5000;

export interface OfflineSnapshot {
  savedAt: number;
  user: VaultUser | null;
  pinStatus: PinStatus | null;
  items: VaultItem[];
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => Uint8Array.from((h.match(/.{2}/g) || []).map((x) => parseInt(x, 16)));
const utf8 = (s: string): Uint8Array => aesjs.utils.utf8.toBytes(s);
const concat = (a: Uint8Array, b: Uint8Array) => {
  const o = new Uint8Array(a.length + b.length);
  o.set(a);
  o.set(b, a.length);
  return o;
};

function stretch(pin: string, salt: Uint8Array): string {
  let h = sha256(concat(salt, utf8(pin)));
  for (let i = 0; i < ITERATIONS; i++) h = sha256(concat(h, salt));
  return hex(h);
}

export async function isOfflineEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(K_ON).catch(() => null)) !== "0";
}
export async function setOfflineEnabled(on: boolean) {
  await SecureStore.setItemAsync(K_ON, on ? "1" : "0");
  if (!on) await clearOffline();
}

async function getKey(create: boolean): Promise<Uint8Array | null> {
  let k = await SecureStore.getItemAsync(K_KEY).catch(() => null);
  if (!k && create) {
    k = hex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(K_KEY, k);
  }
  return k ? unhex(k) : null;
}

/** Call after a successful online PIN entry so the PIN can also unlock offline. */
export async function rememberPin(pin: string) {
  if (!(await isOfflineEnabled())) return;
  const salt = Crypto.getRandomBytes(16);
  await SecureStore.setItemAsync(K_VER, JSON.stringify({ salt: hex(salt), hash: stretch(pin, salt) }));
  await SecureStore.setItemAsync(K_FAILS, "0");
}

export async function saveOffline(snapshot: Omit<OfflineSnapshot, "savedAt">) {
  if (!(await isOfflineEnabled())) return;
  if (!(await SecureStore.getItemAsync(K_VER).catch(() => null))) return; // no PIN verifier yet
  const key = (await getKey(true))!;
  const iv = Crypto.getRandomBytes(16);
  const data = utf8(JSON.stringify({ ...snapshot, savedAt: Date.now() }));
  const ct: Uint8Array = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv)).encrypt(data);
  const tag = hmacSha256(sha256(concat(key, utf8("mac"))), concat(iv, ct));
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify({ v: 1, iv: hex(iv), ct: hex(ct), tag: hex(tag) }));
}

export async function loadOffline(): Promise<OfflineSnapshot | null> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return null;
    const key = await getKey(false);
    if (!key) return null;
    const f = JSON.parse(await FileSystem.readAsStringAsync(FILE));
    const iv = unhex(f.iv), ct = unhex(f.ct);
    const expect = hex(hmacSha256(sha256(concat(key, utf8("mac"))), concat(iv, ct)));
    if (expect !== f.tag) return null; // tampered or corrupt
    const plain: Uint8Array = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv)).decrypt(ct);
    return JSON.parse(aesjs.utils.utf8.fromBytes(plain)) as OfflineSnapshot;
  } catch {
    return null;
  }
}

export async function hasOffline(): Promise<boolean> {
  if (!(await isOfflineEnabled())) return false;
  const ver = await SecureStore.getItemAsync(K_VER).catch(() => null);
  const info = await FileSystem.getInfoAsync(FILE).catch(() => ({ exists: false }));
  return Boolean(ver) && info.exists;
}

export async function offlineSavedAt(): Promise<number | null> {
  return (await loadOffline())?.savedAt ?? null;
}

export async function verifyOfflinePin(pin: string): Promise<"ok" | "bad" | "wiped"> {
  const raw = await SecureStore.getItemAsync(K_VER).catch(() => null);
  if (!raw) return "bad";
  const { salt, hash } = JSON.parse(raw);
  if (stretch(pin, unhex(salt)) === hash) {
    await SecureStore.setItemAsync(K_FAILS, "0");
    return "ok";
  }
  const fails = Number((await SecureStore.getItemAsync(K_FAILS).catch(() => "0")) || 0) + 1;
  if (fails >= MAX_FAILS) {
    await clearOffline();
    return "wiped";
  }
  await SecureStore.setItemAsync(K_FAILS, String(fails));
  return "bad";
}

export async function clearOffline() {
  await FileSystem.deleteAsync(FILE, { idempotent: true }).catch(() => {});
  await SecureStore.deleteItemAsync(K_VER).catch(() => {});
  await SecureStore.deleteItemAsync(K_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(K_FAILS).catch(() => {});
}
