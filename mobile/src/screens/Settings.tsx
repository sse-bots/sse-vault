import React, { useState } from "react";
import { Alert, Linking, Modal, ScrollView, Switch, Text, View } from "react-native";
import { useAuth } from "../auth";
import { API_BASE, APP_VERSION } from "../config";
import { Button, Card, Chip, IconButton } from "../ui";
import { PinPad } from "./Pin";
import { c } from "../theme";

const OPTIONS: { m: number; label: string }[] = [
  { m: 5, label: "5 min" }, { m: 15, label: "15 min" }, { m: 30, label: "30 min" },
  { m: 60, label: "1 hour" }, { m: 0, label: "Session" },
];

export default function Settings() {
  const { user, pinStatus, lock, signOut, bioAvailable, bioEnabled, enableBiometrics, disableBiometrics, setAutoLock, error, clearError } = useAuth();
  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState("");

  const onPin = async (v: string) => {
    setPin(v);
    if (v.length === 6) {
      const ok = await enableBiometrics(v);
      setPin("");
      if (ok) setPinModal(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={{ color: c.text, fontSize: 28, fontWeight: "800", marginBottom: 16 }}>Settings</Text>

      <Card>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>{user?.name}</Text>
        <Text style={{ color: c.muted, marginTop: 2 }}>{user?.email}</Text>
        <Text style={{ color: c.faint, fontSize: 12, marginTop: 6 }}>SSE Accounts · {user?.sseRole}</Text>
      </Card>

      <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600", marginTop: 22, marginBottom: 8 }}>SECURITY</Text>
      <Card>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>Auto-lock</Text>
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 2, marginBottom: 10 }}>
          Lock after the app has been in the background for:
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {OPTIONS.map((o) => (
            <Chip key={o.m} label={o.label} active={pinStatus?.autoLockMinutes === o.m} onPress={() => setAutoLock(o.m)} />
          ))}
        </View>
        {bioAvailable && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>Biometric unlock</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>Use your fingerprint or face instead of the PIN.</Text>
            </View>
            <Switch value={bioEnabled} trackColor={{ true: c.accent, false: c.border }} thumbColor="#fff"
              onValueChange={(v) => (v ? (clearError(), setPinModal(true)) : void disableBiometrics())} />
          </View>
        )}
      </Card>
      <Button title="Lock vault now" icon="lock-closed-outline" variant="ghost" onPress={lock} style={{ marginTop: 12 }} />

      <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600", marginTop: 22, marginBottom: 8 }}>MORE</Text>
      <Button title="Open web vault (import / export, recovery)" icon="globe-outline" variant="ghost"
        onPress={() => Linking.openURL(`${API_BASE}/vault/settings`)} />
      <Button title="Sign out" icon="log-out-outline" variant="danger" style={{ marginTop: 12 }}
        onPress={() => Alert.alert("Sign out?", "You'll need to sign in with SSE Accounts again.", [
          { text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: signOut },
        ])} />
      <Text style={{ color: c.faint, fontSize: 12, textAlign: "center", marginTop: 24 }}>SSE Vault {APP_VERSION}</Text>

      <Modal visible={pinModal} animationType="slide" onRequestClose={() => setPinModal(false)}>
        <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 60, alignItems: "center" }}>
          <View style={{ position: "absolute", top: 40, left: 8 }}>
            <IconButton icon="close" onPress={() => { setPinModal(false); setPin(""); }} />
          </View>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: "800", marginTop: 40 }}>Confirm your PIN</Text>
          <Text style={{ color: c.muted, marginVertical: 8 }}>Enter your Vault PIN to enable biometric unlock.</Text>
          <Text style={{ color: c.danger, height: 36 }}>{error || ""}</Text>
          <PinPad value={pin} onChange={onPin} />
        </View>
      </Modal>
    </ScrollView>
  );
}
