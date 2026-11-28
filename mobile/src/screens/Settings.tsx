import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAuth } from "../auth";
import { api } from "../api";
import { API_BASE } from "../config";
import { useVault } from "../vault";
import { usePrefs } from "../prefs";
import { c } from "../theme";
import { clearOffline, isOfflineEnabled, setOfflineEnabled } from "../offline";
import { currentVersion } from "../updates";
import { useUpdater } from "../Update";
import { ThemeCustomizerCard } from "../ThemeCustomizerCard";
import {
  Button,
  Card,
  Chip,
  Field,
  IconButton,
  SectionTitle,
  SettingsRow,
  Toast,
  useToast,
} from "../ui";
import type { ActivityEvent } from "../types";
import { PinPad } from "./Pin";

const AUTO_LOCK: { m: number; label: string }[] = [
  { m: 1, label: "1 min" },
  { m: 5, label: "5 min" },
  { m: 15, label: "15 min" },
  { m: 30, label: "30 min" },
  { m: 60, label: "1 hour" },
];

export default function Settings({ onImport, onTrash }: { onImport: () => void; onTrash: () => void }) {
  const {
    user,
    pinStatus,
    offline,
    lock,
    signOut,
    bioAvailable,
    bioEnabled,
    enableBiometrics,
    disableBiometrics,
    setAutoLock,
    error,
    clearError,
    reconnect,
  } = useAuth();
  const { theme, setTheme, resetTheme, privacyBlur, setPrivacyBlur } =
    usePrefs();
  const { savedAt } = useVault();
  const updater = useUpdater();
  const toast = useToast();

  const [bioModal, setBioModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [offlineOn, setOfflineOn] = useState(true);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [encModal, setEncModal] = useState(false);
  const [encPass, setEncPass] = useState("");
  const [encBusy, setEncBusy] = useState(false);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    void isOfflineEnabled().then(setOfflineOn);
    if (!offline) {
      void api
        .activity()
        .then((list) => setActivity(Array.isArray(list) ? list : []))
        .catch(() => {});
    }
  }, [offline]);

  const doEncryptedExport = async () => {
    if (encPass.trim().length < 6) {
      Alert.alert("Short passphrase", "Passphrase must be at least 6 characters.");
      return;
    }
    setEncBusy(true);
    try {
      const text = await api.exportEncrypted(encPass.trim());
      const stamp = new Date().toISOString().slice(0, 10);
      const uri = `${FileSystem.cacheDirectory}sse-vault-encrypted-${stamp}.ssevault`;
      await FileSystem.writeAsStringAsync(uri, text);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/json" });
      }
      await FileSystem.deleteAsync(uri, { idempotent: true });
      setEncPass("");
      setEncModal(false);
      toast.show("Encrypted .ssevault exported!");
    } catch (e) {
      Alert.alert("Export failed", (e as Error).message);
    } finally {
      setEncBusy(false);
    }
  };

  const onBioPin = async (v: string) => {
    setPin(v);
    if (v.length === 6) {
      const ok = await enableBiometrics(v);
      setPin("");
      if (ok) setBioModal(false);
    }
  };

  const doExport = async (fmt: "json" | "csv") => {
    Alert.alert(
      `Export ${fmt.toUpperCase()}?`,
      "The file contains your passwords in plain text. Only save it somewhere you trust, and delete it when you're done.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export",
          onPress: async () => {
            try {
              const text = await api.exportText(fmt);
              const stamp = new Date().toISOString().slice(0, 10);
              const uri = `${FileSystem.cacheDirectory}sse-vault-${fmt === "json" ? "backup" : "passwords"}-${stamp}.${fmt}`;
              await FileSystem.writeAsStringAsync(uri, text);
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                  mimeType: fmt === "json" ? "application/json" : "text/csv",
                });
              } else {
                Alert.alert(
                  "Sharing unavailable",
                  "This device can't open the share sheet."
                );
              }
              await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch (e) {
              Alert.alert("Export failed", (e as Error).message);
            }
          },
        },
      ]
    );
  };

  const checkUpdates = async () => {
    setChecking(true);
    const r = await updater.checkNow(true);
    setChecking(false);
    if (!r.hasUpdate) {
      toast.show(r.latest ? "You're up to date" : "Couldn't check for updates");
    }
  };

  const toggleOffline = async (on: boolean) => {
    setOfflineOn(on);
    await setOfflineEnabled(on);
    toast.show(
      on
        ? "Offline copy updates the next time you unlock"
        : "Offline copy erased"
    );
  };

  const ago = savedAt ? new Date(savedAt).toLocaleString() : "—";

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text
          style={{
            color: c.text,
            fontSize: 28,
            fontWeight: "900",
            marginBottom: 16,
          }}
        >
          Settings
        </Text>

        <Card>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "800" }}>
            {user?.name}
          </Text>
          <Text style={{ color: c.muted, marginTop: 2 }}>{user?.email}</Text>
          <Text style={{ color: c.faint, fontSize: 12, marginTop: 6 }}>
            SSE Accounts · {user?.sseRole}
          </Text>
        </Card>

        {/* Exact Website Theme Customizer (Light/Dark/Auto + 12 Presets + 18 Accents + 9 Surfaces + 7 Radii) */}
        <SectionTitle>Appearance</SectionTitle>
        <ThemeCustomizerCard
          theme={theme}
          onChange={setTheme}
          onReset={resetTheme}
        />

        <SectionTitle>Security &amp; Privacy</SectionTitle>
        <Card style={{ padding: 0 }}>
          <SettingsRow
            icon="eye-off-outline"
            title="Privacy Blur Curtain"
            subtitle="Blur emails, passwords, TOTP codes and backup keys on screen"
            right={
              <Switch
                value={privacyBlur}
                trackColor={{ true: c.accent, false: c.border }}
                thumbColor="#fff"
                onValueChange={setPrivacyBlur}
              />
            }
          />
          <SettingsRow
            icon="keypad-outline"
            title="Change Vault PIN"
            subtitle={
              offline
                ? "Needs an internet connection"
                : "Update your 6-digit PIN"
            }
            onPress={offline ? undefined : () => setPinModal(true)}
          />
          {bioAvailable && (
            <SettingsRow
              icon="finger-print"
              title="Biometric unlock"
              subtitle="Use fingerprint or face instead of the PIN"
              right={
                <Switch
                  value={bioEnabled}
                  trackColor={{ true: c.accent, false: c.border }}
                  thumbColor="#fff"
                  onValueChange={(v) =>
                    v
                      ? (clearError(), setBioModal(true))
                      : void disableBiometrics()
                  }
                />
              }
            />
          )}
          <SettingsRow
            icon="lock-closed-outline"
            title="Lock vault now"
            onPress={lock}
            last
          />
        </Card>

        <Card style={{ marginTop: 12, opacity: offline ? 0.5 : 1 }}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "800" }}>
            Auto-lock
          </Text>
          <Text
            style={{
              color: c.muted,
              fontSize: 12,
              marginTop: 2,
              marginBottom: 10,
            }}
          >
            Lock after the app has been in the background for:
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {AUTO_LOCK.map((o) => (
              <Chip
                key={o.m}
                label={o.label}
                active={pinStatus?.autoLockMinutes === o.m}
                onPress={() => !offline && setAutoLock(o.m)}
              />
            ))}
          </View>
        </Card>

        <SectionTitle>Data</SectionTitle>
        <Card style={{ padding: 0 }}>
          <SettingsRow
            icon="trash-outline"
            title="Trash Bin (30-Day Recovery)"
            subtitle="Restore or permanently erase deleted items"
            onPress={offline ? undefined : onTrash}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Export encrypted (.ssevault)"
            subtitle="AES-256-GCM passphrase-protected backup"
            onPress={offline ? undefined : () => setEncModal(true)}
          />
          <SettingsRow
            icon="download-outline"
            title="Import passwords"
            subtitle="CSV, JSON backup, or encrypted .ssevault file"
            onPress={offline ? undefined : onImport}
          />
          <SettingsRow
            icon="share-outline"
            title="Export JSON backup"
            onPress={offline ? undefined : () => doExport("json")}
          />
          <SettingsRow
            icon="document-text-outline"
            title="Export CSV"
            onPress={offline ? undefined : () => doExport("csv")}
            last
          />
        </Card>

        <SectionTitle>Offline access</SectionTitle>
        <Card style={{ padding: 0 }}>
          <SettingsRow
            icon="cloud-offline-outline"
            title="Keep an encrypted offline copy"
            subtitle={`Read your vault without internet. Last synced: ${ago}`}
            right={
              <Switch
                value={offlineOn}
                trackColor={{ true: c.accent, false: c.border }}
                thumbColor="#fff"
                onValueChange={toggleOffline}
              />
            }
          />
          <SettingsRow
            icon="trash-outline"
            title="Erase offline copy"
            danger
            last
            onPress={() =>
              Alert.alert(
                "Erase offline copy?",
                "You'll need an internet connection to open your vault until it syncs again.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Erase",
                    style: "destructive",
                    onPress: async () => {
                      await clearOffline();
                      toast.show("Offline copy erased");
                    },
                  },
                ]
              )
            }
          />
        </Card>
        {offline && (
          <Button
            title="Reconnect now"
            icon="wifi"
            variant="ghost"
            onPress={reconnect}
            style={{ marginTop: 12 }}
          />
        )}

        <SectionTitle>Recent Security Activity</SectionTitle>
        <Card style={{ gap: 8 }}>
          {activity.length === 0 ? (
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {offline ? "Reconnect to view security activity." : "No recent events yet."}
            </Text>
          ) : (
            activity.slice(0, 10).map((ev) => (
              <View
                key={ev.id}
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: c.border,
                  paddingBottom: 6,
                }}
              >
                <Text style={{ color: c.text, fontSize: 12, fontWeight: "700" }}>{ev.label}</Text>
                <Text style={{ color: c.faint, fontSize: 10, marginTop: 2 }}>
                  {ev.client === "native" ? "Android APK" : "Web"} · {new Date(ev.createdAt).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </Card>

        <SectionTitle>About &amp; Auto-Updates</SectionTitle>
        <Card style={{ padding: 0 }}>
          <SettingsRow
            icon="cloud-download-outline"
            title="Auto-download updates on open"
            subtitle="Automatically downloads new APK with a live progress bar on launch"
            right={
              <Switch
                value={updater.autoDownloadOnOpen}
                trackColor={{ true: c.accent, false: c.border }}
                thumbColor="#fff"
                onValueChange={(v) => {
                  void updater.setAutoDownloadOnOpen(v);
                  toast.show(v ? "Auto-download on open enabled" : "Manual update download enabled");
                }}
              />
            }
          />
          <SettingsRow
            icon="refresh-circle-outline"
            title="Check for updates"
            subtitle={
              updater.stage === "downloading"
                ? `Downloading v${updater.latest?.version} · ${Math.round(updater.progress * 100)}%`
                : `Installed version v${currentVersion()}`
            }
            onPress={
              updater.stage === "downloading"
                ? updater.openModal
                : checking
                  ? undefined
                  : checkUpdates
            }
          />
          <SettingsRow
            icon="globe-outline"
            title="Open web vault"
            onPress={() => Linking.openURL(`${API_BASE}/vault/settings`)}
            last
          />
        </Card>

        <Button
          title="Sign out"
          icon="log-out-outline"
          variant="danger"
          style={{ marginTop: 24 }}
          onPress={() =>
            Alert.alert(
              "Sign out?",
              "You'll need to sign in with SSE Accounts again and your offline copy will be erased.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Sign out", style: "destructive", onPress: signOut },
              ]
            )
          }
        />
      </ScrollView>

      <Modal
        visible={bioModal}
        animationType="slide"
        onRequestClose={() => setBioModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: c.bg,
            paddingTop: 60,
            alignItems: "center",
          }}
        >
          <View style={{ position: "absolute", top: 40, left: 8 }}>
            <IconButton
              icon="close"
              onPress={() => {
                setBioModal(false);
                setPin("");
              }}
            />
          </View>
          <Text
            style={{
              color: c.text,
              fontSize: 22,
              fontWeight: "800",
              marginTop: 40,
            }}
          >
            Confirm your PIN
          </Text>
          <Text style={{ color: c.muted, marginVertical: 8 }}>
            Enter your Vault PIN to enable biometric unlock.
          </Text>
          <Text style={{ color: c.danger, height: 36 }}>{error || ""}</Text>
          <PinPad value={pin} onChange={onBioPin} />
        </View>
      </Modal>

      <ChangePin
        visible={pinModal}
        onClose={() => setPinModal(false)}
        onDone={() => toast.show("PIN changed")}
      />
      <Modal visible={encModal} transparent animationType="fade" onRequestClose={() => setEncModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 20 }}>
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "800" }}>Encrypted .ssevault Backup</Text>
              <IconButton icon="close" onPress={() => setEncModal(false)} />
            </View>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              Protected with AES-256-GCM + PBKDF2. Remember this passphrase to restore later.
            </Text>
            <Field
              label="BACKUP PASSPHRASE (MIN 6 CHARS)"
              value={encPass}
              onChangeText={setEncPass}
              placeholder="Choose a strong passphrase..."
              secureTextEntry
            />
            <Button title="Export Encrypted Backup" icon="lock-closed-outline" loading={encBusy} onPress={doEncryptedExport} />
          </Card>
        </View>
      </Modal>
      <Toast message={toast.msg} />
    </View>
  );
}

function ChangePin({
  visible,
  onClose,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { changePin, error, clearError, busy } = useAuth();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");

  const reset = () => {
    setStep(0);
    setCur("");
    setNext("");
    setPin("");
    setMsg("");
    clearError();
  };
  const close = () => {
    reset();
    onClose();
  };

  const onChange = async (v: string) => {
    setPin(v);
    setMsg("");
    clearError();
    if (v.length < 6) return;
    if (step === 0) {
      setCur(v);
      setPin("");
      setStep(1);
      return;
    }
    if (step === 1) {
      if (v === cur) {
        setMsg("The new PIN must be different.");
        setPin("");
        return;
      }
      setNext(v);
      setPin("");
      setStep(2);
      return;
    }
    if (v !== next) {
      setMsg("PINs didn't match. Choose your new PIN again.");
      setPin("");
      setNext("");
      setStep(1);
      return;
    }
    const ok = await changePin(cur, next, v);
    if (ok) {
      onDone();
      close();
    } else {
      setPin("");
      setCur("");
      setNext("");
      setStep(0);
    }
  };

  const titles = [
    "Enter your current PIN",
    "Choose a new PIN",
    "Confirm the new PIN",
  ];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View
        style={{
          flex: 1,
          backgroundColor: c.bg,
          paddingTop: 60,
          alignItems: "center",
        }}
      >
        <View style={{ position: "absolute", top: 40, left: 8 }}>
          <IconButton icon="close" onPress={close} />
        </View>
        <Text
          style={{
            color: c.faint,
            fontSize: 12,
            fontWeight: "700",
            marginTop: 40,
          }}
        >
          STEP {step + 1} OF 3
        </Text>
        <Text
          style={{
            color: c.text,
            fontSize: 22,
            fontWeight: "800",
            marginTop: 6,
          }}
        >
          {titles[step]}
        </Text>
        <Text
          style={{
            color: c.danger,
            height: 50,
            textAlign: "center",
            paddingHorizontal: 30,
            marginTop: 10,
          }}
        >
          {msg || error || ""}
        </Text>
        <PinPad value={pin} onChange={busy ? () => {} : onChange} />
      </View>
    </Modal>
  );
}
