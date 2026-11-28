import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth";
import { Button, Card, Field, IconButton } from "../ui";
import { c, radius } from "../theme";

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
    pinStatus,
    setupPin,
    resetPin,
    startPinReset,
    resetPinWithQuestions,
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

  // Forgot PIN Modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const savedQuestions = pinStatus?.securityQuestions || [];
  const hasQuestions = Boolean(
    pinStatus?.hasSecurityQuestions && savedQuestions.length >= 2
  );
  const [answers, setAnswers] = useState<string[]>(["", ""]);
  const [sqNewPin, setSqNewPin] = useState("");
  const [sqConfirmPin, setSqConfirmPin] = useState("");
  const [forgotErr, setForgotErr] = useState<string | null>(null);

  useEffect(() => {
    if (savedQuestions.length > 0 && answers.length !== savedQuestions.length) {
      setAnswers(savedQuestions.map(() => ""));
    }
  }, [savedQuestions.length, answers.length]);

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
      const ok = isReset
        ? await resetPin(first, next)
        : await setupPin(first, next);
      if (!ok) {
        setFirst(null);
        setPin("");
      }
    } else {
      const ok = await unlock(next);
      if (!ok) setPin("");
    }
  };

  const handleQuestionsReset = async () => {
    setForgotErr(null);
    if (answers.some((a) => !a.trim())) {
      setForgotErr("Please answer all security questions.");
      return;
    }
    if (!/^\d{6}$/.test(sqNewPin) || sqNewPin !== sqConfirmPin) {
      setForgotErr("Enter and confirm a matching 6-digit new PIN.");
      return;
    }
    const ok = await resetPinWithQuestions(answers, sqNewPin, sqConfirmPin);
    if (ok) {
      setForgotOpen(false);
      setSqNewPin("");
      setSqConfirmPin("");
      setAnswers(savedQuestions.map(() => ""));
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
    ? "Verification succeeded. Set your new 6-digit PIN."
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
          !isCreating && bioEnabled
            ? () => void unlockWithBiometrics()
            : undefined
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
            onPress={() => {
              setForgotErr(null);
              clearError();
              setForgotOpen(true);
            }}
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

      {/* Forgot PIN Recovery Modal (Case-Insensitive Security Questions + SSE Accounts Fallback) */}
      <Modal
        visible={forgotOpen}
        animationType="slide"
        onRequestClose={() => setForgotOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 44 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 8,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <IconButton
              icon="close"
              onPress={() => setForgotOpen(false)}
              label="Close"
            />
            <Text
              style={{
                color: c.text,
                fontSize: 17,
                fontWeight: "800",
                flex: 1,
                textAlign: "center",
              }}
            >
              Reset Vault PIN
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
          >
            {forgotErr || error ? (
              <View
                style={{
                  backgroundColor: c.danger + "1a",
                  borderWidth: 1,
                  borderColor: c.danger + "55",
                  borderRadius: radius.md,
                  padding: 12,
                }}
              >
                <Text style={{ color: c.danger, fontSize: 12, fontWeight: "700" }}>
                  {forgotErr || error}
                </Text>
              </View>
            ) : null}

            {hasQuestions ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: c.text, fontSize: 15, fontWeight: "800" }}>
                  Answer Your Security Questions
                </Text>
                <View
                  style={{
                    backgroundColor: c.accentSoft,
                    borderWidth: 1,
                    borderColor: c.accentBorder,
                    borderRadius: radius.md,
                    padding: 10,
                  }}
                >
                  <Text
                    style={{
                      color: c.accentLabel,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    Note: Fields are NOT case-sensitive (uppercase and lowercase
                    letters are treated the same).
                  </Text>
                </View>

                {savedQuestions.map((q, idx) => (
                  <Field
                    key={idx}
                    label={`${idx + 1}. ${q}`}
                    value={answers[idx] || ""}
                    onChangeText={(v) =>
                      setAnswers((prev) =>
                        prev.map((a, i) => (i === idx ? v : a))
                      )
                    }
                    placeholder="Your answer (not case-sensitive)"
                  />
                ))}

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="NEW 6-DIGIT PIN"
                      value={sqNewPin}
                      onChangeText={(v) =>
                        setSqNewPin(v.replace(/\D/g, "").slice(0, 6))
                      }
                      keyboardType="number-pad"
                      maxLength={6}
                      secureTextEntry
                      placeholder="••••••"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="CONFIRM PIN"
                      value={sqConfirmPin}
                      onChangeText={(v) =>
                        setSqConfirmPin(v.replace(/\D/g, "").slice(0, 6))
                      }
                      keyboardType="number-pad"
                      maxLength={6}
                      secureTextEntry
                      placeholder="••••••"
                    />
                  </View>
                </View>

                <Button
                  title="Verify Answers & Reset PIN"
                  icon="shield-checkmark-outline"
                  loading={busy}
                  onPress={() => void handleQuestionsReset()}
                />
              </Card>
            ) : (
              <Card style={{ gap: 8 }}>
                <Text style={{ color: c.text, fontSize: 15, fontWeight: "800" }}>
                  No Security Questions Set Yet
                </Text>
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                  Verify with SSE Accounts below to reset your PIN, then set up
                  case-insensitive Security Questions in Settings → Security &amp;
                  Privacy for instant recovery anytime.
                </Text>
              </Card>
            )}

            <Button
              title={
                hasQuestions
                  ? "Or Verify via SSE Accounts"
                  : "Verify via SSE Accounts & Reset PIN"
              }
              icon="refresh-outline"
              variant="ghost"
              loading={busy}
              onPress={async () => {
                setForgotOpen(false);
                await startPinReset();
              }}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
