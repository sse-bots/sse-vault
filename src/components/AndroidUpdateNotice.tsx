"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Download, ExternalLink, X } from "lucide-react";

type GitHubRelease = {
  tag_name?: string;
  name?: string;
  html_url?: string;
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
    content_type?: string;
  }>;
};

type AvailableUpdate = {
  installedVersion: string;
  latestVersion: string;
  releaseUrl: string;
  apkUrl: string | null;
};

const LATEST_RELEASE_API =
  "https://api.github.com/repos/sse-bots/sse-vault/releases/latest";
const RELEASES_URL = "https://github.com/sse-bots/sse-vault/releases";

function versionParts(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(latest: string, installed: string): boolean {
  const a = versionParts(latest);
  const b = versionParts(installed);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

export function AndroidUpdateNotice() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
        return;
      }

      try {
        const [appInfo, response] = await Promise.all([
          App.getInfo(),
          fetch(LATEST_RELEASE_API, {
            headers: { Accept: "application/vnd.github+json" },
            cache: "no-store",
          }),
        ]);

        if (!response.ok) return;
        const release = (await response.json()) as GitHubRelease;
        const latestVersion = (release.tag_name || "").replace(/^v/i, "");
        const installedVersion = appInfo.version || "0.0.0";
        if (!latestVersion || !isNewerVersion(latestVersion, installedVersion)) {
          return;
        }

        const apk = release.assets?.find((asset) =>
          asset.name?.toLowerCase().endsWith(".apk")
        );

        if (!cancelled) {
          setUpdate({
            installedVersion,
            latestVersion,
            releaseUrl: release.html_url || RELEASES_URL,
            apkUrl: apk?.browser_download_url || null,
          });
        }
      } catch {
        // Update checks are best-effort and must never block vault access.
      }
    }

    void checkForUpdate();
    return () => {
      cancelled = true;
    };
  }, []);

  async function openUpdate() {
    if (!update || opening) return;
    setOpening(true);
    try {
      await Browser.open({ url: update.apkUrl || update.releaseUrl });
    } catch {
      // Fall back to the release page if the native browser plugin is unavailable.
      window.open(update.apkUrl || update.releaseUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  }

  if (!update || dismissed) return null;

  return (
    <aside
      className="mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Download className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-500">
            SSE Vault {update.latestVersion} is available
          </p>
          <p className="mt-0.5 text-[11px] vault-text-muted">
            Installed: {update.installedVersion}. Download the update and approve installation in Android.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void openUpdate()}
          disabled={opening}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-extrabold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          {opening ? "Opening…" : "Update"}
          <ExternalLink className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notice"
          className="rounded-lg p-1.5 vault-text-muted hover:bg-amber-500/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
