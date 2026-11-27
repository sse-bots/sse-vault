import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth";
import { Button } from "../ui";
import { c } from "../theme";

export default function SignIn() {
  const { signIn, busy, error } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: 28, justifyContent: "center" }}>
      <View style={{ alignItems: "center", marginBottom: 40 }}>
        <View style={{ width: 88, height: 88, borderRadius: 26, backgroundColor: c.accent + "22",
          alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Ionicons name="shield-checkmark" size={46} color={c.accent} />
        </View>
        <Text style={{ color: c.text, fontSize: 30, fontWeight: "800" }}>SSE Vault</Text>
        <Text style={{ color: c.muted, fontSize: 15, marginTop: 8, textAlign: "center" }}>
          Passwords, 2FA codes and security keys — encrypted and always with you.
        </Text>
      </View>
      {error ? (
        <Text style={{ color: c.danger, textAlign: "center", marginBottom: 16 }}>{error}</Text>
      ) : null}
      <Button title="Continue with SSE Accounts" icon="log-in-outline" onPress={signIn} loading={busy} />
      <Text style={{ color: c.faint, fontSize: 12, textAlign: "center", marginTop: 18 }}>
        You'll sign in securely in your browser, then return here.
      </Text>
    </View>
  );
}
