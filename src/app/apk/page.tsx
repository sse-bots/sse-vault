import type { Metadata } from "next";
import { fetchLatestApkRelease } from "@/lib/apk-release";
import { ApkDownloadView } from "@/components/ApkDownloadView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Download Android APK — SSE Vault",
  description:
    "Download the official SSE Vault Android APK for faster 6-digit PIN access, live 2FA codes, auto-lock on app switch, and built-in updates.",
};

export default async function ApkPage() {
  const release = await fetchLatestApkRelease();
  return <ApkDownloadView initialRelease={release} />;
}
