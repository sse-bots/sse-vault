import React, { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as ScreenCapture from "expo-screen-capture";
import { PrefsProvider, usePrefs } from "./src/prefs";
import { AuthProvider, useAuth } from "./src/auth";
import { VaultProvider, useVault } from "./src/vault";
import { c } from "./src/theme";
import SignIn from "./src/screens/SignIn";
import PinScreen from "./src/screens/Pin";
import Home from "./src/screens/Home";
import Domain from "./src/screens/Domain";
import Authenticator from "./src/screens/Authenticator";
import Health from "./src/screens/Health";
import Detail from "./src/screens/Detail";
import Form from "./src/screens/Form";
import Import from "./src/screens/Import";
import Settings from "./src/screens/Settings";

type Tab = "vault" | "auth" | "security" | "settings";
type Overlay =
  | { kind: "detail"; id: string; prev?: Overlay }
  | { kind: "domain"; domainKey: string }
  | { kind: "form"; id?: string; presetUrl?: string; prev?: Overlay }
  | { kind: "import" }
  | null;

// Survives theme-change remounts so you stay on the same tab.
let lastTab: Tab = "vault";

function OfflineBar() {
  const { offline, reconnect, busy } = useAuth();
  const { savedAt } = useVault();
  if (!offline) return null;
  return (
    <Pressable onPress={reconnect} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16,
      paddingVertical: 8, backgroundColor: c.warn + "26", borderBottomWidth: 1, borderBottomColor: c.warn + "55" }}>
      <Ionicons name="cloud-offline" size={16} color={c.warn} />
      <Text style={{ color: c.text, fontSize: 12, flex: 1 }}>
        Offline · read-only{savedAt ? ` · synced ${new Date(savedAt).toLocaleString()}` : ""}
      </Text>
      <Text style={{ color: c.warn, fontWeight: "800", fontSize: 12 }}>{busy ? "Connecting…" : "Reconnect"}</Text>
    </Pressable>
  );
}

function Main() {
  const [tab, setTabState] = useState<Tab>(lastTab);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const setTab = (t: Tab) => { lastTab = t; setTabState(t); };

  const back = (): boolean => {
    if (!overlay) return false;
    if (overlay.kind === "detail" || overlay.kind === "form") setOverlay(overlay.prev ?? null);
    else setOverlay(null);
    return true;
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (back()) return true;
      if (tab !== "vault") { setTab("vault"); return true; }
      return false;
    });
    return () => sub.remove();
  });

  const openDetail = (id: string, prev?: Overlay) => setOverlay({ kind: "detail", id, prev });

  let body: React.ReactNode;
  if (overlay?.kind === "detail") {
    body = <Detail id={overlay.id} onBack={back}
      onEdit={() => setOverlay({ kind: "form", id: overlay.id, prev: overlay })}
      onOpen={(id) => openDetail(id, overlay)} />;
  } else if (overlay?.kind === "domain") {
    body = <Domain domainKey={overlay.domainKey} onBack={back}
      onOpen={(id) => openDetail(id, overlay)} onAdd={(url) => setOverlay({ kind: "form", presetUrl: url, prev: overlay })} />;
  } else if (overlay?.kind === "form") {
    body = <Form id={overlay.id} presetUrl={overlay.presetUrl} onClose={back} />;
  } else if (overlay?.kind === "import") {
    body = <Import onClose={back} />;
  } else {
    const tabs: { id: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
      { id: "vault", label: "Vault", icon: "key" },
      { id: "auth", label: "2FA", icon: "timer" },
      { id: "security", label: "Security", icon: "shield-checkmark" },
      { id: "settings", label: "Settings", icon: "settings" },
    ];
    body = (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {tab === "vault" && <Home onOpen={(id) => openDetail(id)} onOpenGroup={(d) => setOverlay({ kind: "domain", domainKey: d })}
            onAdd={() => setOverlay({ kind: "form" })} onSecurity={() => setTab("security")} />}
          {tab === "auth" && <Authenticator onOpen={(id) => openDetail(id)} />}
          {tab === "security" && <Health onOpen={(id) => openDetail(id)} />}
          {tab === "settings" && <Settings onImport={() => setOverlay({ kind: "import" })} />}
        </View>
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card }}>
          {tabs.map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={{ flex: 1, alignItems: "center", paddingVertical: 10 }}>
              <Ionicons name={t.icon} size={22} color={tab === t.id ? c.accent : c.faint} />
              <Text style={{ color: tab === t.id ? c.accent : c.faint, fontSize: 11, fontWeight: "600", marginTop: 2 }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBar />
      {body}
    </View>
  );
}

function Root() {
  const { phase } = useAuth();
  const { themeVersion } = usePrefs();
  if (phase === "loading")
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={c.accent} size="large" /></View>;
  if (phase === "signedOut") return <SignIn />;
  if (phase === "pinSetup" || phase === "locked") return <PinScreen />;
  return <VaultProvider><Main key={themeVersion} /></VaultProvider>;
}

function Shell() {
  usePrefs(); // re-render with new colours when the theme changes
  return (
    <>
      <StatusBar style={c.isLight ? "dark" : "light"} />
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <Root />
      </SafeAreaView>
    </>
  );
}

export default function App() {
  // Block screenshots and hide the app preview in the recents switcher.
  useEffect(() => { void ScreenCapture.preventScreenCaptureAsync().catch(() => {}); }, []);
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
