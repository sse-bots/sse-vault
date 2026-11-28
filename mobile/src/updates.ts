import * as Application from "expo-application";
import { API_BASE, APP_VERSION, GITHUB_REPO } from "./config";

export interface UpdateInfo {
  version: string;
  apkUrl: string | null;
  pageUrl: string;
  sizeBytes: number | null;
  notes: string | null;
}

const parts = (v: string) =>
  v
    .replace(/^v/i, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);

export function isNewerVersion(a: string, b: string): boolean {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const currentVersion = () =>
  Application.nativeApplicationVersion || APP_VERSION;

export async function checkForUpdate(): Promise<{
  latest: UpdateInfo | null;
  hasUpdate: boolean;
}> {
  // 1. Prefer SSE Vault backend proxy (supports private GitHub repos via GITHUB_TOKEN)
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${API_BASE}/api/apk/latest`, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      const rel = data?.release;
      if (rel?.version) {
        const rawApk = rel.apkUrl ? String(rel.apkUrl) : null;
        const resolvedApk =
          rawApk && rawApk.startsWith("/") ? `${API_BASE}${rawApk}` : rawApk;
        const latest: UpdateInfo = {
          version: String(rel.version),
          apkUrl: resolvedApk,
          pageUrl: `${API_BASE}/apk`,
          sizeBytes: typeof rel.apkSizeBytes === "number" ? rel.apkSizeBytes : null,
          notes: rel.changelog || null,
        };
        return {
          latest,
          hasUpdate: isNewerVersion(latest.version, currentVersion()),
        };
      }
    }
  } catch {
    // Fallback to public GitHub API below
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github+json" },
        signal: ctrl.signal,
      }
    );
    clearTimeout(t);
    if (!res.ok) return { latest: null, hasUpdate: false };
    const r = await res.json();
    const version = String(r.tag_name || "").replace(/^v/i, "");
    if (!version) return { latest: null, hasUpdate: false };
    const apk = (
      (r.assets || []) as Array<{
        name?: string;
        browser_download_url?: string;
        size?: number;
      }>
    ).find((a) => String(a.name || "").toLowerCase().endsWith(".apk"));
    const latest: UpdateInfo = {
      version,
      apkUrl: apk?.browser_download_url || null,
      pageUrl: r.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      sizeBytes: typeof apk?.size === "number" ? apk.size : null,
      notes: r.body || null,
    };
    return { latest, hasUpdate: isNewerVersion(version, currentVersion()) };
  } catch {
    return { latest: null, hasUpdate: false };
  }
}
