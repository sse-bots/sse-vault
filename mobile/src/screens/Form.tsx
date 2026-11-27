import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { api } from "../api";
import { useVault } from "../vault";
import { CATEGORIES, type Category, type ItemInput } from "../types";
import { Button, Chip, Field, IconButton, StrengthMeter } from "../ui";
import { evaluatePasswordStrength } from "../lib/domain";
import { c } from "../theme";

const POOL = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_";
function generatePassword(len = 20) {
  const bytes = Crypto.getRandomBytes(len * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < len; i++) {
    if (bytes[i] < 256 - (256 % POOL.length)) out += POOL[bytes[i] % POOL.length];
  }
  return out;
}

const PROVIDERS = ["Google", "GitHub", "Discord", "Microsoft", "Apple", "SSE Accounts"];

export default function Form({ id, presetUrl, onClose }: { id?: string; presetUrl?: string; onClose: () => void }) {
  const { items, refresh } = useVault();
  const existing = id ? items.find((i) => i.id === id) : undefined;
  const [url, setUrl] = useState(existing?.url || presetUrl || "");
  const [label, setLabel] = useState(existing?.label || "");
  const [authType, setAuthType] = useState<"password" | "oauth">(existing?.authType || "password");
  const [provider, setProvider] = useState(existing?.oauthProvider || "Google");
  const [email, setEmail] = useState(existing?.email || "");
  const [username, setUsername] = useState(existing?.username || "");
  const [password, setPassword] = useState(existing?.password || "");
  const [totp, setTotp] = useState(existing?.totpSecret || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [category, setCategory] = useState<Category>(existing?.category || "personal");
  const [favorite, setFavorite] = useState(existing?.favorite || false);
  const [passkey, setPasskey] = useState(existing?.hasPasskey || false);
  const [codes, setCodes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!url.trim()) return Alert.alert("Website required", "Enter the website, e.g. github.com");
    if (authType === "oauth" && !email.trim()) return Alert.alert("Email required", "Enter the email used for sign-in.");
    const codeList = codes.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    const body: ItemInput = {
      url: url.trim(), label: label.trim(), authType, category, favorite, hasPasskey: passkey,
      email: email.trim(), notes: notes.trim(), totpSecret: totp.trim(),
      ...(authType === "oauth"
        ? { oauthProvider: provider }
        : { username: username.trim(), password }),
    };
    setSaving(true);
    try {
      if (existing) {
        await api.updateItem(existing.id, body);
        if (codeList.length) await api.appendCodes(existing.id, codeList);
      } else {
        await api.createItem({ ...body, securityCodes: codeList });
      }
      await refresh();
      onClose();
    } catch (e) {
      Alert.alert("Couldn't save", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
        <IconButton icon="close" onPress={onClose} label="Close" />
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" }}>
          {existing ? "Edit item" : "New item"}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Field label="WEBSITE" value={url} onChangeText={setUrl} placeholder="github.com" keyboardType="url" />
        <Field label="NAME (optional)" value={label} onChangeText={setLabel} placeholder="GitHub – personal" autoCapitalize="words" />

        <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>SIGN-IN TYPE</Text>
        <View style={{ flexDirection: "row", marginBottom: 14 }}>
          <Chip label="Password" active={authType === "password"} onPress={() => setAuthType("password")} />
          <Chip label="Sign in with…" active={authType === "oauth"} onPress={() => setAuthType("oauth")} />
        </View>

        {authType === "oauth" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
            {PROVIDERS.map((p) => <Chip key={p} label={p} active={provider === p} onPress={() => setProvider(p)} />)}
          </View>
        )}

        <Field label="EMAIL" value={email} onChangeText={setEmail} keyboardType="email-address" />
        {authType === "password" && (
          <>
            <Field label="USERNAME" value={username} onChangeText={setUsername} />
            <Field label="PASSWORD" value={password} onChangeText={setPassword} />
            {password ? (() => { const st = evaluatePasswordStrength(password); return <StrengthMeter score={st.score} label={st.label} color={st.color} />; })() : null}
            <Button title="Generate strong password" variant="ghost" icon="sparkles-outline"
              onPress={() => setPassword(generatePassword())} style={{ marginBottom: 16, height: 44 }} />
          </>
        )}

        <Field label="TOTP SECRET OR otpauth:// LINK" value={totp} onChangeText={setTotp} placeholder="JBSWY3DPEHPK3PXP" />
        <Field label={existing ? "ADD BACKUP CODES (space or newline separated)" : "BACKUP CODES (space or newline separated)"}
          value={codes} onChangeText={setCodes} multiline />
        <Field label="NOTES" value={notes} onChangeText={setNotes} multiline autoCapitalize="sentences" />

        <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>CATEGORY</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
          {CATEGORIES.map((k) => <Chip key={k.id} label={k.label} color={k.color} active={category === k.id} onPress={() => setCategory(k.id)} />)}
        </View>

        <ToggleRow label="Favorite" value={favorite} onChange={setFavorite} />
        <ToggleRow label="Has a passkey" value={passkey} onChange={setPasskey} />

        <Button title={existing ? "Save changes" : "Add to vault"} onPress={save} loading={saving} style={{ marginTop: 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
      <Text style={{ color: c.text, fontSize: 16 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: c.border }} thumbColor="#fff" />
    </View>
  );
}
