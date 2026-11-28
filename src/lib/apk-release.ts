export interface ApkReleaseInfo {
  available: boolean;
  repo: string;
  isPrivateProxied: boolean;
  version: string | null;
  tagName: string | null;
  releaseName: string | null;
  publishedAt: string | null;
  releaseUrl: string;
  releasesListUrl: string;
  apkUrl: string | null;
  apkAssetId: number | null;
  apkName: string | null;
  apkSizeBytes: number | null;
  downloadCount: number;
  changelog: string | null;
}

type GitHubAsset = {
  id?: number;
  name?: string;
  browser_download_url?: string;
  size?: number;
  download_count?: number;
};

type GitHubReleaseResponse = {
  tag_name?: string;
  name?: string;
  html_url?: string;
  published_at?: string;
  body?: string;
  draft?: boolean;
  assets?: GitHubAsset[];
};

export const DEFAULT_APK_REPO = (
  process.env.NEXT_PUBLIC_APK_GITHUB_REPO || "sse-bots/sse-vault"
).trim();

export function getGitHubAuthHeaders(): Record<string, string> {
  const token = (process.env.GITHUB_TOKEN || "").trim();
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "SSE-Vault-Web",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function formatApkSize(bytes: number | null | undefined): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${Math.max(1, Math.round(kb))} KB`;
}

function mapRelease(
  repo: string,
  release: GitHubReleaseResponse | null,
  hasToken: boolean
): ApkReleaseInfo {
  const releasesListUrl = `https://github.com/${repo}/releases`;
  if (!release) {
    return {
      available: false,
      repo,
      isPrivateProxied: hasToken,
      version: null,
      tagName: null,
      releaseName: null,
      publishedAt: null,
      releaseUrl: releasesListUrl,
      releasesListUrl,
      apkUrl: null,
      apkAssetId: null,
      apkName: null,
      apkSizeBytes: null,
      downloadCount: 0,
      changelog: null,
    };
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apkAsset =
    assets.find((a) => (a.name || "").toLowerCase().endsWith(".apk")) || null;
  const tagName = (release.tag_name || "").trim() || null;
  const version = tagName ? tagName.replace(/^v/i, "") : null;

  const apkUrl = apkAsset
    ? hasToken && apkAsset.id
      ? `/api/apk/download?assetId=${apkAsset.id}&name=${encodeURIComponent(apkAsset.name || "SSE-Vault.apk")}`
      : apkAsset.browser_download_url || null
    : null;

  return {
    available: Boolean(apkUrl || release.html_url),
    repo,
    isPrivateProxied: hasToken,
    version,
    tagName,
    releaseName: (release.name || "").trim() || tagName,
    publishedAt: release.published_at || null,
    releaseUrl: release.html_url || releasesListUrl,
    releasesListUrl,
    apkUrl,
    apkAssetId: typeof apkAsset?.id === "number" ? apkAsset.id : null,
    apkName: apkAsset?.name || null,
    apkSizeBytes: typeof apkAsset?.size === "number" ? apkAsset.size : null,
    downloadCount:
      typeof apkAsset?.download_count === "number" ? apkAsset.download_count : 0,
    changelog: (release.body || "").trim() || null,
  };
}

export async function fetchLatestApkRelease(): Promise<ApkReleaseInfo> {
  const repo = DEFAULT_APK_REPO;
  const hasToken = Boolean((process.env.GITHUB_TOKEN || "").trim());
  const headers = getGitHubAuthHeaders();

  try {
    const latestRes = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      { headers, next: { revalidate: 300 } }
    );
    if (latestRes.ok) {
      const json = (await latestRes.json()) as GitHubReleaseResponse;
      return mapRelease(repo, json, hasToken);
    }

    const listRes = await fetch(
      `https://api.github.com/repos/${repo}/releases?per_page=5`,
      { headers, next: { revalidate: 300 } }
    );
    if (listRes.ok) {
      const list = (await listRes.json()) as GitHubReleaseResponse[];
      const firstValid = Array.isArray(list)
        ? list.find((r) => !r.draft) || null
        : null;
      return mapRelease(repo, firstValid, hasToken);
    }
  } catch {
    /* fallback */
  }

  return mapRelease(repo, null, hasToken);
}
