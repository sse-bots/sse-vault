import { NextResponse } from "next/server";
import {
  DEFAULT_APK_REPO,
  fetchLatestApkRelease,
  getGitHubAuthHeaders,
} from "@/lib/apk-release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let assetId = Number(searchParams.get("assetId") || "0");
  let fileName = (searchParams.get("name") || "SSE-Vault.apk").replace(
    /[^a-zA-Z0-9._-]/g,
    "-"
  );

  const token = (process.env.GITHUB_TOKEN || "").trim();
  if (!token) {
    const latest = await fetchLatestApkRelease();
    return NextResponse.redirect(latest.apkUrl || latest.releaseUrl);
  }

  if (!assetId) {
    const latest = await fetchLatestApkRelease();
    if (!latest.apkAssetId) {
      return NextResponse.redirect(latest.releaseUrl);
    }
    assetId = latest.apkAssetId;
    if (latest.apkName) fileName = latest.apkName;
  }

  const ghRes = await fetch(
    `https://api.github.com/repos/${DEFAULT_APK_REPO}/releases/assets/${assetId}`,
    {
      headers: {
        ...getGitHubAuthHeaders(),
        Accept: "application/octet-stream",
      },
      redirect: "follow",
      cache: "no-store",
    }
  );

  if (!ghRes.ok || !ghRes.body) {
    return NextResponse.json(
      { error: "Could not download APK asset from GitHub." },
      { status: 502 }
    );
  }

  return new NextResponse(ghRes.body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
