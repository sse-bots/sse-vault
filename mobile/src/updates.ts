import * as Application from "expo-application";
import { APP_VERSION, GITHUB_REPO } from "./config";

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

/** Returns the newest GitHub release, and whether it is newer than the installed app. */
export async function checkForUpdate(): Promise<{ latest: UpdateInfo | null; hasUpdate: boolean }> {
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
