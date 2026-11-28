import type { Metadata } from "next";
import { fetchLatestApkRelease } from "@/lib/apk-release";
import { ApkDownloadView } from "@/components/ApkDownloadView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Download Android APK — SSE Vault",
  description:
    "Download the official native SSE Vault Android APK with biometric unlock, encrypted offline mode, QR TOTP scanner, and built-in updates.",
};

export default async function ApkPage() {
  const release = await fetchLatestApkRelease();
  return <ApkDownloadView initialRelease={release} />;
}
