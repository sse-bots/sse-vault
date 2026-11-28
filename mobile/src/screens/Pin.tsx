import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth";
import { Button } from "../ui";
import { c } from "../theme";

export function PinPad({
  value,
  onChange,
  length = 6,
  onBio,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  onBio?: () => void;
}) {
  const press = (d: string) => value.length < length && onChange(value + d);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del"];
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 14, marginBottom: 36 }}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 15,
              height: 15,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: i < value.length ? c.accent : c.faint,
              backgroundColor: i < value.length ? c.accent : "transparent",
            }}
          />
        ))}
      </View>
      <View
        style={{
          width: 276,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 18,
          justifyContent: "center",
        }}
      >
        {keys.map((k) => {
          if (k === "bio") {
            return onBio ? (
              <Key key={k} onPress={onBio}>
                <Ionicons name="finger-print" size={28} color={c.accent} />
              </Key>
            ) : (
              <View key={k} style={{ width: 76, height: 76 }} />
            );
          }
          if (k === "del") {
            return (
              <Key
                key={k}
                onPress={() => onChange(value.slice(0, -1))}
                transparent
              >
                <Ionicons name="backspace-outline" size={26} color={c.muted} />
              </Key>
            );
          }
          return (
            <Key key={k} onPress={() => press(k)}>
              <Text style={{ color: c.text, fontSize: 28, fontWeight: "600" }}>
                {k}
              </Text>
            </Key>
          );
        })}
      </View>
    </View>
  );
}

function Key({
  children,
  onPress,
  transparent,
}: {
  children: React.ReactNode;
  onPress: () => void;
  transparent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: transparent
          ? "transparent"
          : pressed
            ? c.card2
            : c.card,
        borderWidth: transparent ? 0 : 1,
        borderColor: c.border,
      })}
    >
      {children}
    </Pressable>
  );
}

export default function PinScreen() {
  const {
    phase,
    setupPin,
    resetPin,
    startPinReset,
    unlock,
    unlockWithBiometrics,
    bioEnabled,
    error,
    clearError,
    busy,
    signOut,
    user,
    offline,
  } = useAuth();
  const isSetup = phase === "pinSetup";
  const isReset = phase === "pinReset";
  const isCreating = isSetup || isReset;

  const [pin, setPin] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (phase === "locked" && bioEnabled) void unlockWithBiometrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onChange = async (next: string) => {
    setPin(next);
    setLocalErr(null);
    clearError();
    if (next.length < 6) return;
    if (isCreating) {
      if (!first) {
        setFirst(next);
        setPin("");
        return;
      }
      if (next !== first) {
        setLocalErr("PINs didn't match. Try again.");
        setFirst(null);
        setPin("");
        return;
      }
      const ok = isReset ? await resetPin(first, next) : await setupPin(first, next);
      if (!ok) {
        setFirst(null);
        setPin("");
      }
    } else {
      const ok = await unlock(next);
      if (!ok) setPin("");
    }
  };

  const title = isReset
    ? first
      ? "Confirm new PIN"
      : "Choose new Vault PIN"
    : isSetup
      ? first
        ? "Confirm your PIN"
        : "Create a Vault PIN"
      : "Enter Vault PIN";
  const sub = isReset
    ? "SSE Accounts verified. Set your new 6-digit PIN."
    : isSetup
      ? first
        ? "Enter the same 6 digits again."
        : "Choose a 6-digit PIN to protect your vault."
      : offline
        ? "Offline · encrypted local copy (changes queue for sync)"
        : user?.email || "";

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <Text style={{ color: c.text, fontSize: 24, fontWeight: "800" }}>
        {title}
      </Text>
      <Text style={{ color: c.muted, marginTop: 6, textAlign: "center" }}>
        {sub}
      </Text>
      <Text
        style={{
          color: c.danger,
          minHeight: 28,
          marginTop: 12,
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        {localErr || error || ""}
      </Text>
      <PinPad
        value={pin}
        onChange={busy ? () => {} : onChange}
        onBio={
          !isCreating && bioEnabled ? () => void unlockWithBiometrics() : undefined
        }
      />

      <View
        style={{
          marginTop: 28,
          flexDirection: "row",
          gap: 10,
          alignItems: "center",
        }}
      >
        {!isCreating && !offline && (
          <Button
            title="Forgot PIN?"
            variant="ghost"
            onPress={() => void startPinReset()}
            loading={busy}
            style={{ height: 42, paddingHorizontal: 16 }}
          />
        )}
        <Button
          title="Sign out"
          variant="ghost"
          onPress={signOut}
          style={{ height: 42, paddingHorizontal: 18 }}
        />
      </View>
    </View>
  );
}
