import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { getMongoClient } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = toNextJsHandler(auth);

export async function GET(req: NextRequest) {
  await getMongoClient();
  return handler.GET(req);
}

export async function POST(req: NextRequest) {
  await getMongoClient();
  return handler.POST(req);
}
