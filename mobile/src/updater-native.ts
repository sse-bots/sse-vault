import { NativeModules, Platform } from "react-native";

interface SseUpdaterNative {
  canInstallPackages(): Promise<boolean>;
  openInstallPermissionSettings(): Promise<boolean>;
  installApk(filePath: string): Promise<boolean>;
}

const nativeMod: SseUpdaterNative | null =
  Platform.OS === "android" && NativeModules?.SseUpdater
    ? (NativeModules.SseUpdater as SseUpdaterNative)
    : null;

export function hasNativeApkInstaller(): boolean {
  return Boolean(nativeMod);
}

export async function canInstallApkPackages(): Promise<boolean> {
  if (!nativeMod) return false;
  try {
    return await nativeMod.canInstallPackages();
  } catch {
    return false;
  }
}

export async function openInstallUnknownAppsSettings(): Promise<boolean> {
  if (!nativeMod) return false;
  try {
    return await nativeMod.openInstallPermissionSettings();
  } catch {
    return false;
  }
}

export async function launchNativeApkInstaller(fileUri: string): Promise<boolean> {
  if (!nativeMod) return false;
  return nativeMod.installApk(fileUri);
}
