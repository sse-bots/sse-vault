import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import {
  checkForUpdate,
  currentVersion,
  formatBytes,
  type UpdateInfo,
} from "./updates";
import {
  canInstallApkPackages,
  hasNativeApkInstaller,
  launchNativeApkInstaller,
  openInstallUnknownAppsSettings,
} from "./updater-native";
import { Banner, Button, Card, IconButton } from "./ui";
import { c, radius } from "./theme";

const APK_CACHE_URI = `${FileSystem.cacheDirectory}sse-vault-update.apk`;
const K_AUTO_DL = "sse_auto_download_update";

export type UpdateStage =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "permissionNeeded"
  | "readyToInstall"
  | "installing"
  | "error";

interface UpdaterCtx {
  latest: UpdateInfo | null;
  hasUpdate: boolean;
  stage: UpdateStage;
  progress: number; // 0..1
  downloadedBytes: number;
  totalBytes: number;
  error: string | null;
  modalOpen: boolean;
  autoDownloadOnOpen: boolean;
  setAutoDownloadOnOpen: (on: boolean) => Promise<void>;
  openModal: () => void;
  minimizeToBar: () => void;
  dismissForSession: () => void;
  checkNow: (manual?: boolean) => Promise<{ latest: UpdateInfo | null; hasUpdate: boolean }>;
  startUpdate: (target?: UpdateInfo) => Promise<void>;
  cancelDownload: () => Promise<void>;
  retryInstall: () => Promise<void>;
  grantInstallPermission: () => Promise<void>;
}

const Ctx = createContext<UpdaterCtx>(null as unknown as UpdaterCtx);
export const useUpdater = () => useContext(Ctx);

export function openUpdate(u: UpdateInfo) {
  Linking.openURL(u.apkUrl || u.pageUrl).catch(() => {});
}

export function UpdaterProvider({ children }: { children: React.ReactNode }) {
  const [latest, setLatest] = useState<UpdateInfo | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [stage, setStage] = useState<UpdateStage>("idle");
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [autoDownloadOnOpen, setAutoDownloadState] = useState(true);

  const downloadRef = useRef<FileSystem.DownloadResumable | null>(null);
  const downloadedFileRef = useRef<string | null>(null);
  const waitingForPermRef = useRef(false);
  const didAutoCheckRef = useRef(false);

  const triggerInstall = useCallback(async (fileUri: string) => {
    downloadedFileRef.current = fileUri;
    if (!hasNativeApkInstaller()) {
      setStage("readyToInstall");
      return;
    }

    const allowed = await canInstallApkPackages();
    if (!allowed) {
      waitingForPermRef.current = true;
      setStage("permissionNeeded");
      setModalOpen(true);
      return;
    }

    waitingForPermRef.current = false;
    setStage("installing");
    try {
      await launchNativeApkInstaller(fileUri);
      // Keep readyToInstall state so user can tap "Install Now" again if they dismissed Android's dialog
      setStage("readyToInstall");
    } catch (e) {
      const msg = (e as Error).message || "Could not open Android installer.";
      if (msg.includes("Allow from this source") || msg.includes("PERMISSION")) {
        waitingForPermRef.current = true;
        setStage("permissionNeeded");
        setModalOpen(true);
      } else {
        setError(msg);
        setStage("error");
      }
    }
  }, []);

  const startUpdate = useCallback(
    async (target?: UpdateInfo) => {
      const info = target || latest;
      if (!info) return;
      if (!info.apkUrl) {
        openUpdate(info);
        return;
      }
      if (!hasNativeApkInstaller()) {
        openUpdate(info);
        return;
      }

      // Cancel any in-flight download
      if (downloadRef.current) {
        await downloadRef.current.cancelAsync().catch(() => {});
        downloadRef.current = null;
      }

      setLatest(info);
      setHasUpdate(true);
      setError(null);
      setProgress(0);
      setDownloadedBytes(0);
      setTotalBytes(info.sizeBytes || 0);
      setStage("downloading");

      try {
        await FileSystem.deleteAsync(APK_CACHE_URI, { idempotent: true }).catch(
          () => {}
        );

        const expectedFallback = info.sizeBytes || 0;
        const resumable = FileSystem.createDownloadResumable(
          info.apkUrl,
          APK_CACHE_URI,
          {},
          (dp) => {
            const written = dp.totalBytesWritten || 0;
            const total =
              dp.totalBytesExpectedToWrite > 0
                ? dp.totalBytesExpectedToWrite
                : expectedFallback;
            setDownloadedBytes(written);
            if (total > 0) {
              setTotalBytes(total);
              setProgress(Math.min(1, written / total));
            }
          }
        );
        downloadRef.current = resumable;

        const res = await resumable.downloadAsync();
        downloadRef.current = null;

        if (!res || res.status < 200 || res.status >= 300 || !res.uri) {
          throw new Error(
            `Update download failed (HTTP ${res?.status ?? "network"}).`
          );
        }

        setProgress(1);
        await triggerInstall(res.uri);
      } catch (e) {
        downloadRef.current = null;
        const msg = (e as Error).message || "Download failed.";
        if (msg.toLowerCase().includes("cancel")) {
          setStage("available");
          return;
        }
        setError(msg);
        setStage("error");
      }
    },
    [latest, triggerInstall]
  );

  const checkNow = useCallback(
    async (manual = false) => {
      if (stage === "downloading" || stage === "installing") {
        return { latest, hasUpdate };
      }
      if (manual) {
        setStage("checking");
        setError(null);
      }
      const res = await checkForUpdate();
      setLatest(res.latest);
      setHasUpdate(res.hasUpdate);

      if (res.hasUpdate && res.latest) {
        setStage("available");
        if (manual || dismissedVersion !== res.latest.version) {
          setModalOpen(true);
        }
        // If this is an automatic check on app open and Auto-Download is ON, start the live progress bar right away
        if (!manual && autoDownloadOnOpen && res.latest.apkUrl && hasNativeApkInstaller()) {
          void startUpdate(res.latest);
        }
      } else {
        setStage("idle");
        // Clean up any stale cached APK once already updated
        void FileSystem.deleteAsync(APK_CACHE_URI, { idempotent: true }).catch(
          () => {}
        );
      }
      return res;
    },
    [stage, latest, hasUpdate, dismissedVersion, autoDownloadOnOpen, startUpdate]
  );

  // Load saved auto-download preference & run automatic check on app launch
  useEffect(() => {
    let alive = true;
    (async () => {
      const savedPref = await SecureStore.getItemAsync(K_AUTO_DL).catch(() => null);
      const autoOn = savedPref !== "0";
      if (!alive) return;
      setAutoDownloadState(autoOn);

      if (didAutoCheckRef.current) return;
      didAutoCheckRef.current = true;

      const res = await checkForUpdate();
      if (!alive) return;
      setLatest(res.latest);
      setHasUpdate(res.hasUpdate);
      if (res.hasUpdate && res.latest) {
        setStage("available");
        setModalOpen(true);
        if (autoOn && res.latest.apkUrl && hasNativeApkInstaller()) {
          void startUpdate(res.latest);
        }
      } else {
        void FileSystem.deleteAsync(APK_CACHE_URI, { idempotent: true }).catch(
          () => {}
        );
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-resume APK install immediately when user returns from Android "Allow from this source" screen
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (
        nextState === "active" &&
        waitingForPermRef.current &&
        downloadedFileRef.current
      ) {
        void canInstallApkPackages().then((ok) => {
          if (ok && downloadedFileRef.current) {
            void triggerInstall(downloadedFileRef.current);
          }
        });
      }
    });
    return () => sub.remove();
  }, [triggerInstall]);

  const setAutoDownloadOnOpen = async (on: boolean) => {
    setAutoDownloadState(on);
    await SecureStore.setItemAsync(K_AUTO_DL, on ? "1" : "0").catch(() => {});
  };

  const cancelDownload = async () => {
    if (downloadRef.current) {
      await downloadRef.current.cancelAsync().catch(() => {});
      downloadRef.current = null;
    }
    setStage(hasUpdate ? "available" : "idle");
    setProgress(0);
    setDownloadedBytes(0);
  };

  const retryInstall = async () => {
    if (downloadedFileRef.current) {
      await triggerInstall(downloadedFileRef.current);
    } else if (latest) {
      await startUpdate(latest);
    }
  };

  const grantInstallPermission = async () => {
    waitingForPermRef.current = true;
    await openInstallUnknownAppsSettings();
  };

  const dismissForSession = () => {
    setModalOpen(false);
    if (latest) setDismissedVersion(latest.version);
  };

  return (
    <Ctx.Provider
      value={{
        latest,
        hasUpdate,
        stage,
        progress,
        downloadedBytes,
        totalBytes,
        error,
        modalOpen,
        autoDownloadOnOpen,
        setAutoDownloadOnOpen,
        openModal: () => setModalOpen(true),
        minimizeToBar: () => setModalOpen(false),
        dismissForSession,
        checkNow,
        startUpdate,
        cancelDownload,
        retryInstall,
        grantInstallPermission,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/**
 * Persistent top bar shown whenever an update is actively downloading,
 * waiting for install permission, or ready to install — so you can see
 * the live update bar running across every screen!
 */
export function UpdateRunningBar() {
  const {
    latest,
    stage,
    progress,
    downloadedBytes,
    totalBytes,
    openModal,
    retryInstall,
    grantInstallPermission,
  } = useUpdater();

  if (
    !latest ||
    (stage !== "downloading" &&
      stage !== "permissionNeeded" &&
      stage !== "readyToInstall" &&
      stage !== "installing" &&
      stage !== "error")
  ) {
    return null;
  }

  const pct = Math.round(progress * 100);
  const label =
    stage === "downloading"
      ? `Updating to v${latest.version} · ${pct}%${totalBytes > 0 ? ` (${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)})` : ""}`
      : stage === "permissionNeeded"
        ? `Update v${latest.version} downloaded · Tap to allow install`
        : stage === "readyToInstall"
          ? `Update v${latest.version} ready · Tap to install`
          : stage === "installing"
            ? `Opening Android installer for v${latest.version}…`
            : `Update v${latest.version} failed · Tap for details`;

  const actionText =
    stage === "downloading"
      ? "View"
      : stage === "permissionNeeded"
        ? "Allow"
        : stage === "readyToInstall"
          ? "Install"
          : stage === "error"
            ? "Retry"
            : "";

  const handlePress = () => {
    if (stage === "permissionNeeded") {
      void grantInstallPermission();
    } else if (stage === "readyToInstall") {
      void retryInstall();
    } else {
      openModal();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{
        backgroundColor: c.card,
        borderBottomWidth: 1,
        borderBottomColor: stage === "error" ? c.danger + "66" : c.accentBorder,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 9,
        }}
      >
        {stage === "downloading" || stage === "installing" ? (
          <ActivityIndicator size="small" color={c.accent} />
        ) : (
          <Ionicons
            name={
              stage === "error"
                ? "alert-circle"
                : stage === "permissionNeeded"
                  ? "shield-checkmark-outline"
                  : "cloud-done-outline"
            }
            size={18}
            color={stage === "error" ? c.danger : c.ok}
          />
        )}
        <Text
          numberOfLines={1}
          style={{ color: c.text, fontSize: 12, fontWeight: "700", flex: 1 }}
        >
          {label}
        </Text>
        {actionText ? (
          <View
            style={{
              backgroundColor:
                stage === "error" ? c.danger + "22" : c.accentSoft,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                color: stage === "error" ? c.danger : c.accentLabel,
                fontSize: 11,
                fontWeight: "900",
              }}
            >
              {actionText}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Live Progress Track */}
      <View
        style={{
          height: 4,
          width: "100%",
          backgroundColor: c.card2,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${stage === "downloading" ? Math.max(4, pct) : stage === "error" ? 100 : 100}%`,
            backgroundColor:
              stage === "error"
                ? c.danger
                : stage === "readyToInstall" || stage === "installing"
                  ? c.ok
                  : c.accent,
          }}
        />
      </View>
    </Pressable>
  );
}

/**
 * Sleek Update Modal shown automatically when an update is found on app launch
 * or when the user taps the running update bar / Check for updates.
 */
export function UpdateModal() {
  const {
    latest,
    stage,
    progress,
    downloadedBytes,
    totalBytes,
    error,
    modalOpen,
    minimizeToBar,
    dismissForSession,
    startUpdate,
    cancelDownload,
    retryInstall,
    grantInstallPermission,
  } = useUpdater();

  if (!modalOpen || !latest) return null;

  const pct = Math.round(progress * 100);
  const isDownloading = stage === "downloading";

  return (
    <Modal
      visible={modalOpen}
      transparent
      animationType="fade"
      onRequestClose={isDownloading ? minimizeToBar : dismissForSession}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.74)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Card style={{ gap: 14, maxHeight: "82%" }}>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                flex: 1,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: radius.md,
                  backgroundColor: c.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="cloud-download-outline"
                  size={22}
                  color={c.accentLabel}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: c.text, fontSize: 17, fontWeight: "900" }}
                >
                  {isDownloading
                    ? "Updating SSE Vault…"
                    : stage === "readyToInstall"
                      ? "Update Ready to Install"
                      : stage === "permissionNeeded"
                        ? "One-Time Install Permission"
                        : `Update Available · v${latest.version}`}
                </Text>
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 11,
                    fontFamily: "monospace",
                    marginTop: 2,
                  }}
                >
                  v{currentVersion()} → v{latest.version}
                  {latest.sizeBytes ? ` · ${formatBytes(latest.sizeBytes)}` : ""}
                </Text>
              </View>
            </View>
            <IconButton
              icon="close"
              onPress={isDownloading ? minimizeToBar : dismissForSession}
              label="Close"
            />
          </View>

          {/* Live Download Progress Bar */}
          {(isDownloading || stage === "readyToInstall" || stage === "installing") && (
            <View
              style={{
                backgroundColor: c.card2,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.lg,
                padding: 14,
                gap: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: c.text, fontSize: 12, fontWeight: "800" }}
                >
                  {isDownloading
                    ? "Downloading signed APK…"
                    : stage === "installing"
                      ? "Launching Android installer…"
                      : "Download complete"}
                </Text>
                <Text
                  style={{
                    color: isDownloading ? c.accentLabel : c.ok,
                    fontSize: 13,
                    fontWeight: "900",
                    fontFamily: "monospace",
                  }}
                >
                  {isDownloading ? `${pct}%` : "100%"}
                </Text>
              </View>

              <View
                style={{
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: c.borderStrong,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    borderRadius: 5,
                    width: `${isDownloading ? Math.max(4, pct) : 100}%`,
                    backgroundColor: isDownloading ? c.accent : c.ok,
                  }}
                />
              </View>

              <Text
                style={{
                  color: c.muted,
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              >
                {totalBytes > 0
                  ? `${formatBytes(downloadedBytes)} of ${formatBytes(totalBytes)}`
                  : downloadedBytes > 0
                    ? `${formatBytes(downloadedBytes)} downloaded`
                    : "Connecting to SSE Vault release server…"}
              </Text>
            </View>
          )}

          {/* One-Time Android Permission Helper */}
          {stage === "permissionNeeded" && (
            <View
              style={{
                backgroundColor: c.accentSoft,
                borderWidth: 1,
                borderColor: c.accentBorder,
                borderRadius: radius.lg,
                padding: 13,
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: c.accentLabel,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                Allow SSE Vault to install updates
              </Text>
              <Text style={{ color: c.text, fontSize: 12, lineHeight: 18 }}>
                Tap below, turn on &ldquo;Allow from this source&rdquo; once, and
                SSE Vault will automatically finish updating as soon as you come
                back.
              </Text>
            </View>
          )}

          {/* Error Notice */}
          {error ? (
            <View
              style={{
                backgroundColor: c.danger + "1a",
                borderWidth: 1,
                borderColor: c.danger + "55",
                borderRadius: radius.md,
                padding: 11,
              }}
            >
              <Text style={{ color: c.danger, fontSize: 12, fontWeight: "700" }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Changelog Notes */}
          {latest.notes && !isDownloading ? (
            <ScrollView
              style={{
                maxHeight: 140,
                backgroundColor: c.card2,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.md,
                padding: 11,
              }}
            >
              <Text
                style={{
                  color: c.muted,
                  fontSize: 11,
                  fontWeight: "800",
                  marginBottom: 4,
                }}
              >
                WHAT&apos;S NEW
              </Text>
              <Text style={{ color: c.text, fontSize: 12, lineHeight: 18 }}>
                {latest.notes}
              </Text>
            </ScrollView>
          ) : null}

          {/* Action Buttons */}
          {isDownloading ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                title="Hide to Bar"
                variant="ghost"
                onPress={minimizeToBar}
                style={{ flex: 1, height: 44 }}
              />
              <Button
                title="Cancel"
                variant="danger"
                onPress={() => void cancelDownload()}
                style={{ flex: 1, height: 44 }}
              />
            </View>
          ) : stage === "permissionNeeded" ? (
            <View style={{ gap: 8 }}>
              <Button
                title="Allow & Continue Install"
                icon="shield-checkmark-outline"
                onPress={() => void grantInstallPermission()}
              />
              <Button
                title="Later"
                variant="ghost"
                onPress={minimizeToBar}
                style={{ height: 42 }}
              />
            </View>
          ) : stage === "readyToInstall" ? (
            <View style={{ gap: 8 }}>
              <Button
                title={`Install v${latest.version} Now`}
                icon="checkmark-circle-outline"
                onPress={() => void retryInstall()}
              />
              <Button
                title="Install Later"
                variant="ghost"
                onPress={minimizeToBar}
                style={{ height: 42 }}
              />
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <Button
                title={stage === "error" ? "Retry Update" : `Update to v${latest.version}`}
                icon="cloud-download-outline"
                onPress={() => void startUpdate(latest)}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button
                  title="Later"
                  variant="ghost"
                  onPress={dismissForSession}
                  style={{ flex: 1, height: 42 }}
                />
                {stage === "error" && (
                  <Button
                    title="Open in Browser"
                    variant="ghost"
                    onPress={() => openUpdate(latest)}
                    style={{ flex: 1, height: 42 }}
                  />
                )}
              </View>
            </View>
          )}
        </Card>
      </View>
    </Modal>
  );
}

/**
 * Compact Home screen card when an update is available but the user tapped "Later"
 * or hasn't started downloading yet.
 */
export function UpdateNotice() {
  const { latest, hasUpdate, stage, startUpdate, openModal } = useUpdater();
  const [hidden, setHidden] = useState<string | null>(null);

  if (
    !hasUpdate ||
    !latest ||
    hidden === latest.version ||
    stage === "downloading" ||
    stage === "readyToInstall" ||
    stage === "permissionNeeded"
  ) {
    return null;
  }

  return (
    <Banner
      icon="cloud-download-outline"
      title={`Update available · v${latest.version}`}
      body="Tap below to download and install the update right inside SSE Vault."
      action="Update now"
      onAction={() => {
        openModal();
        void startUpdate(latest);
      }}
      onClose={() => setHidden(latest.version)}
    />
  );
}
