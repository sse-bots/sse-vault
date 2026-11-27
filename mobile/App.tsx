import React, { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as ScreenCapture from "expo-screen-capture";
import { AuthProvider, useAuth } from "./src/auth";
import { VaultProvider } from "./src/vault";
import { c } from "./src/theme";
import SignIn from "./src/screens/SignIn";
import PinScreen from "./src/screens/Pin";
import Home from "./src/screens/Home";
import Authenticator from "./src/screens/Authenticator";
import Detail from "./src/screens/Detail";
import Form from "./src/screens/Form";
import Settings from "./src/screens/Settings";

type Tab = "vault" | "auth" | "settings";
type Overlay = { kind: "detail"; id: string } | { kind: "form"; id?: string; from?: string } | null;

function Main() {
  const [tab, setTab] = useState<Tab>("vault");
  const [overlay, setOverlay] = useState<Overlay>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (overlay?.kind === "form") { setOverlay(overlay.from ? { kind: "detail", id: overlay.from } : null); return true; }
      if (overlay) { setOverlay(null); return true; }
      if (tab !== "vault") { setTab("vault"); return true; }
      return false;
    });
    return () => sub.remove();
  }, [overlay, tab]);

  if (overlay?.kind === "detail")
    return <Detail id={overlay.id} onBack={() => setOverlay(null)} onEdit={() => setOverlay({ kind: "form", id: overlay.id, from: overlay.id })} />;
  if (overlay?.kind === "form")
    return <Form id={overlay.id} onClose={() => setOverlay(overlay.from ? { kind: "detail", id: overlay.from } : null)} />;

  const tabs: { id: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
    { id: "vault", label: "Vault", icon: "key" },
    { id: "auth", label: "Authenticator", icon: "timer" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === "vault" && <Home onOpen={(id) => setOverlay({ kind: "detail", id })} onAdd={() => setOverlay({ kind: "form" })} />}
        {tab === "auth" && <Authenticator onOpen={(id) => setOverlay({ kind: "detail", id })} />}
        {tab === "settings" && <Settings />}
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

function Root() {
  const { phase } = useAuth();
  if (phase === "loading")
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={c.accent} size="large" /></View>;
  if (phase === "signedOut") return <SignIn />;
  if (phase === "pinSetup" || phase === "locked") return <PinScreen />;
  return <VaultProvider><Main /></VaultProvider>;
}

export default function App() {
  // Block screenshots and hide the app preview in the recents switcher.
  useEffect(() => { void ScreenCapture.preventScreenCaptureAsync().catch(() => {}); }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <Root />
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
