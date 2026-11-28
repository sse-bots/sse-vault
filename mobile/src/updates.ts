import * as Application from "expo-application";
import { API_BASE, APP_VERSION, GITHUB_REPO } from "./config";

export interface UpdateInfo {
  version: string;
  apkUrl: string | null;
  pageUrl: string;
  notes: string | null;
}

const parts = (v: string) => v.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
function isNewer(a: string, b: string) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

export const currentVersion = () => Application.nativeApplicationVersion || APP_VERSION;

export async function checkForUpdate(): Promise<{ latest: UpdateInfo | null; hasUpdate: boolean }> {
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
        const resolvedApk = rawApk && rawApk.startsWith("/") ? `${API_BASE}${rawApk}` : rawApk;
        const latest: UpdateInfo = {
          version: String(rel.version),
          apkUrl: resolvedApk,
          pageUrl: `${API_BASE}/apk`,
          notes: rel.changelog || null,
        };
        return { latest, hasUpdate: isNewer(latest.version, currentVersion()) };
      }
    }
  } catch {
    // Fallback to public GitHub API below
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { latest: null, hasUpdate: false };
    const r = await res.json();
    const version = String(r.tag_name || "").replace(/^v/i, "");
    if (!version) return { latest: null, hasUpdate: false };
    const apk = (r.assets || []).find((a: any) => String(a.name || "").toLowerCase().endsWith(".apk"));
    const latest: UpdateInfo = {
      version,
      apkUrl: apk?.browser_download_url || null,
      pageUrl: r.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      notes: r.body || null,
    };
    return { latest, hasUpdate: isNewer(version, currentVersion()) };
  } catch {
    return { latest: null, hasUpdate: false };
  }
}
