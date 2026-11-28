import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import aesjs from "aes-js";
import { hmacSha256, sha256 } from "./totp";
import type { ItemInput, PinStatus, VaultItem, VaultUser } from "./types";

const FILE = `${FileSystem.documentDirectory}vault-cache.json`;
const QUEUE_FILE = `${FileSystem.documentDirectory}vault-queue.json`;
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

export type OfflineQueuedOp =
  | { id: string; kind: "create"; tempId: string; body: ItemInput; queuedAt: number }
  | { id: string; kind: "update"; itemId: string; body: ItemInput; queuedAt: number }
  | { id: string; kind: "toggleCode"; itemId: string; codeId: string; used: boolean; queuedAt: number }
  | { id: string; kind: "delete"; itemId: string; queuedAt: number };

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

async function encryptAndWrite(path: string, obj: unknown) {
  const key = (await getKey(true))!;
  const iv = Crypto.getRandomBytes(16);
  const data = utf8(JSON.stringify(obj));
  const ct: Uint8Array = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv)).encrypt(data);
  const tag = hmacSha256(sha256(concat(key, utf8("mac"))), concat(iv, ct));
  await FileSystem.writeAsStringAsync(path, JSON.stringify({ v: 1, iv: hex(iv), ct: hex(ct), tag: hex(tag) }));
}

async function readAndDecrypt<T>(path: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const key = await getKey(false);
    if (!key) return null;
    const f = JSON.parse(await FileSystem.readAsStringAsync(path));
    const iv = unhex(f.iv), ct = unhex(f.ct);
    const expect = hex(hmacSha256(sha256(concat(key, utf8("mac"))), concat(iv, ct)));
    if (expect !== f.tag) return null;
    const plain: Uint8Array = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv)).decrypt(ct);
    return JSON.parse(aesjs.utils.utf8.fromBytes(plain)) as T;
  } catch {
    return null;
  }
}

export async function rememberPin(pin: string) {
  if (!(await isOfflineEnabled())) return;
  const salt = Crypto.getRandomBytes(16);
  await SecureStore.setItemAsync(K_VER, JSON.stringify({ salt: hex(salt), hash: stretch(pin, salt) }));
  await SecureStore.setItemAsync(K_FAILS, "0");
}

export async function saveOffline(snapshot: Omit<OfflineSnapshot, "savedAt">) {
  if (!(await isOfflineEnabled())) return;
  if (!(await SecureStore.getItemAsync(K_VER).catch(() => null))) return;
  await encryptAndWrite(FILE, { ...snapshot, savedAt: Date.now() });
}

export async function loadOffline(): Promise<OfflineSnapshot | null> {
  return readAndDecrypt<OfflineSnapshot>(FILE);
}

export async function loadOfflineQueue(): Promise<OfflineQueuedOp[]> {
  return (await readAndDecrypt<OfflineQueuedOp[]>(QUEUE_FILE)) ?? [];
}

export async function saveOfflineQueue(ops: OfflineQueuedOp[]) {
  if (ops.length === 0) {
    await FileSystem.deleteAsync(QUEUE_FILE, { idempotent: true }).catch(() => {});
    return;
  }
  await encryptAndWrite(QUEUE_FILE, ops);
}

export async function enqueueOfflineOp(op: OfflineQueuedOp): Promise<OfflineQueuedOp[]> {
  const prev = await loadOfflineQueue();
  const next = [...prev, op];
  await saveOfflineQueue(next);
  return next;
}

export async function hasOffline(): Promise<boolean> {
  if (!(await isOfflineEnabled())) return false;
  const ver = await SecureStore.getItemAsync(K_VER).catch(() => null);
  const info = await FileSystem.getInfoAsync(FILE).catch(() => ({ exists: false }));
  return Boolean(ver) && info.exists;
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
  await FileSystem.deleteAsync(QUEUE_FILE, { idempotent: true }).catch(() => {});
  await SecureStore.deleteItemAsync(K_VER).catch(() => {});
  await SecureStore.deleteItemAsync(K_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(K_FAILS).catch(() => {});
}
