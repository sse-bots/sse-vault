import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth";
import { Button } from "../ui";
import { c } from "../theme";

export function PinPad({ value, onChange, length = 6, onBio }: {
  value: string; onChange: (v: string) => void; length?: number; onBio?: () => void;
}) {
  const press = (d: string) => value.length < length && onChange(value + d);
  const keys = ["1","2","3","4","5","6","7","8","9","bio","0","del"];
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 14, marginBottom: 36 }}>
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2,
            borderColor: i < value.length ? c.accent : c.border,
            backgroundColor: i < value.length ? c.accent : "transparent" }} />
        ))}
      </View>
      <View style={{ width: 288, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {keys.map((k) => {
          if (k === "bio" && !onBio) return <View key={k} style={{ width: 84, height: 70 }} />;
          return (
            <Pressable key={k}
              onPress={() => (k === "del" ? onChange(value.slice(0, -1)) : k === "bio" ? onBio?.() : press(k))}
              style={({ pressed }) => ({ width: 84, height: 70, borderRadius: 20, marginBottom: 12,
                alignItems: "center", justifyContent: "center",
                backgroundColor: k === "bio" || k === "del" ? "transparent" : pressed ? c.card2 : c.card })}>
              {k === "del" ? <Ionicons name="backspace-outline" size={26} color={c.muted} />
                : k === "bio" ? <Ionicons name="finger-print" size={30} color={c.accent} />
                : <Text style={{ color: c.text, fontSize: 28, fontWeight: "600" }}>{k}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function PinScreen() {
  const { phase, setupPin, unlock, unlockWithBiometrics, bioEnabled, error, clearError, busy, signOut, user } = useAuth();
  const setup = phase === "pinSetup";
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    if (phase === "locked" && bioEnabled) void unlockWithBiometrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onChange = async (v: string) => {
    clearError();
    setMismatch(false);
    setPin(v);
    if (v.length < 6) return;
    if (setup) {
      if (!first) { setFirst(v); setPin(""); return; }
      if (first !== v) { setMismatch(true); setFirst(null); setPin(""); return; }
      await setupPin(first, v);
    } else {
      const ok = await unlock(v);
      if (!ok) setPin("");
    }
  };

  const title = setup ? (first ? "Confirm your PIN" : "Create a Vault PIN") : "Unlock your vault";
  const sub = setup
    ? "Choose a 6-digit PIN. You'll use it to unlock the vault."
    : user ? `Signed in as ${user.name}` : "";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 90, alignItems: "center" }}>
      <Ionicons name="lock-closed" size={34} color={c.accent} />
      <Text style={{ color: c.text, fontSize: 24, fontWeight: "800", marginTop: 14 }}>{title}</Text>
      <Text style={{ color: c.muted, marginTop: 6, marginBottom: 14, textAlign: "center", paddingHorizontal: 30 }}>{sub}</Text>
      <Text style={{ color: c.danger, height: 40, textAlign: "center", paddingHorizontal: 30 }}>
        {mismatch ? "PINs didn't match. Start again." : error || ""}
      </Text>
      <PinPad value={pin} onChange={busy ? () => {} : onChange}
        onBio={!setup && bioEnabled ? () => void unlockWithBiometrics() : undefined} />
      {!setup && (
        <Button title="Sign out" variant="ghost" onPress={signOut} style={{ marginTop: 10, height: 42 }} />
      )}
    </View>
  );
}
