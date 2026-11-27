import { API_BASE } from "./config";
import type { ItemInput, PinStatus, VaultItem, VaultUser } from "./types";

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
  logout: () => request("/api/auth/logout", { method: "POST" }).catch(() => null),

  pin: (body: Record<string, unknown>) =>
    request<{ ok: boolean; pinStatus: PinStatus; pinToken?: string }>("/api/vault/pin", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  items: async () =>
    (await request<{ items: VaultItem[] }>("/api/vault")).items,
  createItem: (body: ItemInput) =>
    request("/api/vault", { method: "POST", body: JSON.stringify(body) }),
  updateItem: (id: string, body: ItemInput) =>
    request(`/api/vault/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
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
