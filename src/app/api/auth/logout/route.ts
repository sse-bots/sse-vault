import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { clearPinUnlockCookie } from "@/lib/vault-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  res.cookies.delete(SESSION_COOKIE);
  clearPinUnlockCookie(res);
  return res;
}
