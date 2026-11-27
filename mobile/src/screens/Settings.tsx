import React, { useEffect, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAuth } from "../auth";
import { api } from "../api";
import { API_BASE } from "../config";
import { useVault } from "../vault";
import { usePrefs } from "../prefs";
import { ACCENTS, SURFACES, c } from "../theme";
import { clearOffline, isOfflineEnabled, setOfflineEnabled } from "../offline";
import { checkForUpdate } from "../updates";
import { currentVersion } from "../updates";
import { openUpdate } from "../Update";
import { Button, Card, Chip, IconButton, SectionTitle, SettingsRow, Toast, useToast } from "../ui";
import { PinPad } from "./Pin";

const AUTO_LOCK: { m: number; label: string }[] = [
  { m: 1, label: "1 min" }, { m: 5, label: "5 min" }, { m: 15, label: "15 min" },
  { m: 30, label: "30 min" }, { m: 60, label: "1 hour" },
];

export default function Settings({ onImport }: { onImport: () => void }) {
  const { user, pinStatus, offline, lock, signOut, bioAvailable, bioEnabled, enableBiometrics,
    disableBiometrics, setAutoLock, error, clearError, reconnect } = useAuth();
  const { theme, setTheme } = usePrefs();
  const { savedAt } = useVault();
  const toast = useToast();
  const [bioModal, setBioModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [offlineOn, setOfflineOn] = useState(true);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => { void isOfflineEnabled().then(setOfflineOn); }, []);

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
        { text: "Export", onPress: async () => {
          try {
            const text = await api.exportText(fmt);
            const stamp = new Date().toISOString().slice(0, 10);
            const uri = `${FileSystem.cacheDirectory}sse-vault-${fmt === "json" ? "backup" : "passwords"}-${stamp}.${fmt}`;
            await FileSystem.writeAsStringAsync(uri, text);
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri, { mimeType: fmt === "json" ? "application/json" : "text/csv" });
            } else {
              Alert.alert("Sharing unavailable", "This device can't open the share sheet.");
            }
            await FileSystem.deleteAsync(uri, { idempotent: true });
          } catch (e) {
            Alert.alert("Export failed", (e as Error).message);
          }
        } },
      ]
    );
  };

  const checkUpdates = async () => {
    setChecking(true);
    const r = await checkForUpdate();
    setChecking(false);
    if (r.hasUpdate && r.latest) {
      Alert.alert(`Version ${r.latest.version} is available`, "Download the new APK and tap it to install over the current app.", [
        { text: "Later", style: "cancel" }, { text: "Download", onPress: () => openUpdate(r.latest!) },
      ]);
    } else toast.show(r.latest ? "You're up to date" : "Couldn't check for updates");
  };

  const toggleOffline = async (on: boolean) => {
    setOfflineOn(on);
    await setOfflineEnabled(on);
    toast.show(on ? "Offline copy updates the next time you unlock" : "Offline copy erased");
  };

  const ago = savedAt ? new Date(savedAt).toLocaleString() : "—";

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: "900", marginBottom: 16 }}>Settings</Text>

        <Card>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "800" }}>{user?.name}</Text>
          <Text style={{ color: c.muted, marginTop: 2 }}>{user?.email}</Text>
          <Text style={{ color: c.faint, fontSize: 12, marginTop: 6 }}>SSE Accounts · {user?.sseRole}</Text>
        </Card>

        <SectionTitle>Appearance</SectionTitle>
        <Card>
          <Text style={{ color: c.text, fontWeight: "700", marginBottom: 10 }}>Mode</Text>
          <View style={{ flexDirection: "row" }}>
            <Chip label="Dark" active={theme.mode === "dark"} onPress={() => setTheme({ mode: "dark" })} />
            <Chip label="Light" active={theme.mode === "light"} onPress={() => setTheme({ mode: "light" })} />
          </View>
          <Text style={{ color: c.text, fontWeight: "700", marginVertical: 10 }}>Surface</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {SURFACES.map((s) => (
              <Pressable key={s.id} onPress={() => setTheme({ surface: s.id })} style={{ alignItems: "center", width: 62 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: s.dot,
                  borderWidth: 3, borderColor: theme.surface === s.id ? c.accent : "transparent" }} />
                <Text style={{ color: theme.surface === s.id ? c.text : c.muted, fontSize: 11, marginTop: 4 }}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: c.text, fontWeight: "700", marginVertical: 10 }}>Accent colour</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {ACCENTS.map((a) => (
              <Pressable key={a.id} onPress={() => setTheme({ accent: a.id })}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: a.c,
                  borderWidth: 3, borderColor: theme.accent === a.id ? c.text : "transparent" }} />
            ))}
          </View>
        </Card>

        <SectionTitle>Security</SectionTitle>
        <Card style={{ padding: 0 }}>
          <SettingsRow icon="keypad-outline" title="Change Vault PIN" subtitle={offline ? "Needs an internet connection" : "Update your 6-digit PIN"}
            onPress={offline ? undefined : () => setPinModal(true)} />
          {bioAvailable && (
            <SettingsRow icon="finger-print" title="Biometric unlock" subtitle="Use fingerprint or face instead of the PIN"
              right={<Switch value={bioEnabled} trackColor={{ true: c.accent, false: c.border }} thumbColor="#fff"
                onValueChange={(v) => (v ? (clearError(), setBioModal(true)) : void disableBiometrics())} />} />
          )}
          <SettingsRow icon="lock-closed-outline" title="Lock vault now" onPress={lock} last />
        </Card>
        <Card style={{ marginTop: 12, opacity: offline ? 0.5 : 1 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>Auto-lock</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 2, marginBottom: 10 }}>
            Lock after the app has been in the background for:
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {AUTO_LOCK.map((o) => (
              <Chip key={o.m} label={o.label} active={pinStatus?.autoLockMinutes === o.m}
                onPress={() => !offline && setAutoLock(o.m)} />
            ))}
          </View>
        </Card>

        <SectionTitle>Data</SectionTitle>
        <Card style={{ padding: 0 }}>
          <SettingsRow icon="download-outline" title="Import passwords" subtitle="CSV from Chrome, Bitwarden, 1Password… or JSON backup"
            onPress={offline ? undefined : onImport} />
          <SettingsRow icon="share-outline" title="Export JSON backup" onPress={offline ? undefined : () => doExport("json")} />
          <SettingsRow icon="document-text-outline" title="Export CSV" onPress={offline ? undefined : () => doExport("csv")} last />
        </Card>

        <SectionTitle>Offline access</SectionTitle>
        <Card style={{ padding: 0 }}>
          <SettingsRow icon="cloud-offline-outline" title="Keep an encrypted offline copy"
            subtitle={`Read your vault without internet. Last synced: ${ago}`}
            right={<Switch value={offlineOn} trackColor={{ true: c.accent, false: c.border }} thumbColor="#fff" onValueChange={toggleOffline} />} />
          <SettingsRow icon="trash-outline" title="Erase offline copy" danger last
            onPress={() => Alert.alert("Erase offline copy?", "You'll need an internet connection to open your vault until it syncs again.",
              [{ text: "Cancel", style: "cancel" }, { text: "Erase", style: "destructive", onPress: async () => { await clearOffline(); toast.show("Offline copy erased"); } }])} />
        </Card>
        {offline && <Button title="Reconnect now" icon="wifi" variant="ghost" onPress={reconnect} style={{ marginTop: 12 }} />}

        <SectionTitle>About</SectionTitle>
        <Card style={{ padding: 0 }}>
          <SettingsRow icon="refresh-circle-outline" title="Check for updates" subtitle={`Installed version ${currentVersion()}`}
            onPress={checking ? undefined : checkUpdates} />
          <SettingsRow icon="globe-outline" title="Open web vault" onPress={() => Linking.openURL(`${API_BASE}/vault/settings`)} last />
        </Card>

        <Button title="Sign out" icon="log-out-outline" variant="danger" style={{ marginTop: 24 }}
          onPress={() => Alert.alert("Sign out?", "You'll need to sign in with SSE Accounts again and your offline copy will be erased.", [
            { text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: signOut },
          ])} />
      </ScrollView>

      <Modal visible={bioModal} animationType="slide" onRequestClose={() => setBioModal(false)}>
        <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 60, alignItems: "center" }}>
          <View style={{ position: "absolute", top: 40, left: 8 }}>
            <IconButton icon="close" onPress={() => { setBioModal(false); setPin(""); }} />
          </View>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: "800", marginTop: 40 }}>Confirm your PIN</Text>
          <Text style={{ color: c.muted, marginVertical: 8 }}>Enter your Vault PIN to enable biometric unlock.</Text>
          <Text style={{ color: c.danger, height: 36 }}>{error || ""}</Text>
          <PinPad value={pin} onChange={onBioPin} />
        </View>
      </Modal>

      <ChangePin visible={pinModal} onClose={() => setPinModal(false)} onDone={() => toast.show("PIN changed")} />
      <Toast message={toast.msg} />
    </View>
  );
}

function ChangePin({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const { changePin, error, clearError, busy } = useAuth();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");

  const reset = () => { setStep(0); setCur(""); setNext(""); setPin(""); setMsg(""); clearError(); };
  const close = () => { reset(); onClose(); };

  const onChange = async (v: string) => {
    setPin(v);
    setMsg("");
    clearError();
    if (v.length < 6) return;
    if (step === 0) { setCur(v); setPin(""); setStep(1); return; }
    if (step === 1) {
      if (v === cur) { setMsg("The new PIN must be different."); setPin(""); return; }
      setNext(v); setPin(""); setStep(2); return;
    }
    if (v !== next) { setMsg("PINs didn't match. Choose your new PIN again."); setPin(""); setNext(""); setStep(1); return; }
    const ok = await changePin(cur, next, v);
    if (ok) { onDone(); close(); } else { setPin(""); setCur(""); setNext(""); setStep(0); }
  };

  const titles = ["Enter your current PIN", "Choose a new PIN", "Confirm the new PIN"];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 60, alignItems: "center" }}>
        <View style={{ position: "absolute", top: 40, left: 8 }}><IconButton icon="close" onPress={close} /></View>
        <Text style={{ color: c.faint, fontSize: 12, fontWeight: "700", marginTop: 40 }}>STEP {step + 1} OF 3</Text>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: "800", marginTop: 6 }}>{titles[step]}</Text>
        <Text style={{ color: c.danger, height: 50, textAlign: "center", paddingHorizontal: 30, marginTop: 10 }}>{msg || error || ""}</Text>
        <PinPad value={pin} onChange={busy ? () => {} : onChange} />
      </View>
    </Modal>
  );
}
