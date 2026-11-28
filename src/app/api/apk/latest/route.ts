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
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
