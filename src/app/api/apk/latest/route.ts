import { NextResponse } from "next/server";
import { fetchLatestApkRelease } from "@/lib/apk-release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const release = await fetchLatestApkRelease();
  return NextResponse.json(
    { release },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    }
  );
}
