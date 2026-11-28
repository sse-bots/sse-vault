import { API_BASE } from "./config";
import type {
  ActivityEvent,
  Category,
  ItemInput,
  PinStatus,
  TrashedItem,
  VaultItem,
  VaultUser,
} from "./types";

export const tokens: { session: string | null; pin: string | null } = {
  session: null,
  pin: null,
};

type Handlers = { onUnauthorized?: () => void; onLocked?: () => void };
const handlers: Handlers = {};
export function setApiHandlers(h: Handlers) {
  Object.assign(handlers, h);
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-sse-client": "native",
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };
  if (tokens.session) headers.Authorization = `Bearer ${tokens.session}`;
  if (tokens.pin) headers["x-vault-pin-token"] = tokens.pin;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("No connection. Check your internet and try again.", 0, null);
  }
  const data = await res.json().catch(() => null);

  if (res.status === 401 && path !== "/api/vault/pin") handlers.onUnauthorized?.();
  if (res.status === 423) handlers.onLocked?.();
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }
  return data as T;
}

export interface MeResponse {
  authenticated: boolean;
  user: VaultUser | null;
  pinStatus: PinStatus | null;
}

export const api = {
  me: () => request<MeResponse>("/api/me"),
  exportText: async (format: "json" | "csv", ids?: string[]) => {
    const q = ids && ids.length ? `&ids=${encodeURIComponent(ids.join(","))}` : "";
    const res = await fetch(`${API_BASE}/api/vault/export?format=${format}${q}`, {
      headers: {
        "x-sse-client": "native",
        Authorization: `Bearer ${tokens.session}`,
        "x-vault-pin-token": tokens.pin || "",
      },
    });
    if (!res.ok) throw new ApiError("Export failed. Unlock the vault and try again.", res.status, null);
    return res.text();
  },
  exportEncrypted: async (passphrase: string, ids?: string[]) => {
    const res = await fetch(`${API_BASE}/api/vault/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sse-client": "native",
        Authorization: `Bearer ${tokens.session}`,
        "x-vault-pin-token": tokens.pin || "",
      },
      body: JSON.stringify({ passphrase, ids }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new ApiError(j?.error || "Encrypted export failed.", res.status, j);
    }
    return res.text();
  },
  importEntries: (body: unknown) =>
    request<any>("/api/vault/import", { method: "POST", body: JSON.stringify(body) }),
  reencrypt: (oldHexKey?: string) =>
    request<{ ok: boolean; migratedCount: number; stillLockedCount: number }>(
      "/api/vault/reencrypt",
      {
        method: "POST",
        body: JSON.stringify(oldHexKey ? { oldHexKey } : {}),
      }
    ),
  breachCheck: () =>
    request<{
      ok: boolean;
      checkedCount: number;
      compromised: Array<{ id: string; count: number }>;
      checkedAt: string;
    }>("/api/vault/breach-check", { method: "POST", body: "{}" }),
  activity: async () => {
    const res = await request<{ events?: ActivityEvent[] }>("/api/vault/activity");
    return Array.isArray(res?.events) ? res.events : [];
  },
  trashList: async () => {
    const res = await request<{ items?: TrashedItem[] }>("/api/vault/trash");
    return Array.isArray(res?.items) ? res.items : [];
  },
  trashAction: (body: { action: "restore" | "delete" | "empty"; id?: string }) =>
    request<any>("/api/vault/trash", { method: "POST", body: JSON.stringify(body) }),
  bulk: (body: { action: "trash"; ids: string[] } | { action: "category"; ids: string[]; category: Category }) =>
    request<{ ok: boolean; updatedCount: number }>("/api/vault/bulk", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createShare: (itemId: string, expiresMinutes: "10" | "60" | "1440") =>
    request<{ ok: boolean; url: string; expiresAt: string }>("/api/vault/share", {
      method: "POST",
      body: JSON.stringify({ itemId, expiresMinutes }),
    }),
  logout: () => request("/api/auth/logout", { method: "POST" }).catch(() => null),
  pin: (body: Record<string, unknown>) =>
    request<{ ok: boolean; pinStatus: PinStatus; pinToken?: string }>("/api/vault/pin", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  items: async () => {
    const res = await request<{ items?: VaultItem[] }>("/api/vault");
    return Array.isArray(res?.items) ? res.items : [];
  },
  createItem: (body: ItemInput) =>
    request<{ ok: boolean; item?: VaultItem; addedToExistingGroup?: boolean }>("/api/vault", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateItem: (id: string, body: ItemInput) =>
    request<{ ok: boolean; item?: VaultItem }>(`/api/vault/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteItem: (id: string) => request(`/api/vault/${id}`, { method: "DELETE" }),
  toggleCode: (id: string, codeId: string, used: boolean) =>
    request(`/api/vault/${id}/codes`, {
      method: "PATCH",
      body: JSON.stringify({ action: "toggle", codeId, used }),
    }),
  appendCodes: (id: string, codes: string[]) =>
    request(`/api/vault/${id}/codes`, {
      method: "PATCH",
      body: JSON.stringify({ action: "append", codes }),
    }),
};
