import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { api } from "../api";
import { useVault } from "../vault";
import { parsePasswordImportFile, type ImportParseResult } from "../lib/import-parser";
import { Button, Card, Chip, Field, IconButton, StatBox } from "../ui";
import { c } from "../theme";

type Strategy = "skip" | "update" | "duplicate";
interface Summary { total: number; newCount: number; exactDuplicateCount: number; conflictCount: number; invalidCount: number }

export default function Import({ onClose }: { onClose: () => void }) {
  const { refresh } = useVault();
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ImportParseResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("skip");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [encRaw, setEncRaw] = useState<string | null>(null);
  const [encName, setEncName] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const entriesFor = (p: ImportParseResult) => p.entries.slice(0, 500);

  const preview = async (p: ImportParseResult, st: Strategy) => {
    const res = await api.importEntries({ mode: "preview", conflictStrategy: st, entries: entriesFor(p) });
    setSummary(res.summary);
  };

  const pick = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      setBusy(true);
      setDone(null);
      const text = await FileSystem.readAsStringAsync(a.uri);
      await FileSystem.deleteAsync(a.uri, { idempotent: true }).catch(() => {});
      const trimmed = text.trim();
      if (a.name.toLowerCase().endsWith(".ssevault") || (trimmed.startsWith("{") && trimmed.includes('"sse-vault-encrypted"'))) {
        setEncRaw(trimmed);
        setEncName(a.name);
        setParsed(null);
        setSummary(null);
        return;
      }
      setEncRaw(null);
      const p = parsePasswordImportFile(a.name, text);
      if (!p.entries.length) throw new Error("No usable entries were found in that file.");
      setFileName(a.name);
      setParsed(p);
      await preview(p, strategy);
    } catch (e) {
      Alert.alert("Couldn't read file", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changeStrategy = async (st: Strategy) => {
    setStrategy(st);
    if (!parsed) return;
    try { setBusy(true); await preview(parsed, st); } catch (e) { Alert.alert("Error", (e as Error).message); } finally { setBusy(false); }
  };

  const previewEncrypted = async () => {
    if (!encRaw || !passphrase.trim()) return;
    setBusy(true);
    try {
      const res = await api.importEntries({
        mode: "preview",
        conflictStrategy: strategy,
        encryptedBackup: encRaw,
        passphrase,
      });
      setSummary(res.summary);
    } catch (e) {
      Alert.alert("Could not unlock backup", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (encRaw) {
      setBusy(true);
      try {
        const res = await api.importEntries({
          mode: "commit",
          conflictStrategy: strategy,
          encryptedBackup: encRaw,
          passphrase,
        });
        await refresh();
        setDone(`Imported ${res.importedCount}, updated ${res.updatedCount}, skipped ${res.skippedCount}.`);
        setEncRaw(null);
        setSummary(null);
      } catch (e) {
        Alert.alert("Import failed", (e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!parsed) return;
    setBusy(true);
    try {
      const res = await api.importEntries({ mode: "commit", conflictStrategy: strategy, entries: entriesFor(parsed) });
      await refresh();
      setDone(`Imported ${res.importedCount}, updated ${res.updatedCount}, skipped ${res.skippedCount}.`);
      setParsed(null);
      setSummary(null);
    } catch (e) {
      Alert.alert("Import failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
        <IconButton icon="close" onPress={onClose} label="Close" />
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" }}>Import passwords</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Card>
          <Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>Choose a file</Text>
          <Text style={{ color: c.muted, marginTop: 4, marginBottom: 14, lineHeight: 20 }}>
            Works with CSV exports from Chrome, Edge, Bitwarden, 1Password and others, or a JSON backup made by SSE Vault.
            The file is read on your phone, then deleted from the app's cache.
          </Text>
          <Button title={fileName ? "Choose a different file" : "Choose file"} icon="document-attach-outline" onPress={pick} loading={busy && !parsed} />
        </Card>

        {encRaw && !summary && !done && (
          <Card style={{ marginTop: 14, gap: 10 }}>
            <Text style={{ color: c.ok, fontWeight: "800", fontSize: 14 }}>
              Encrypted Backup: {encName}
            </Text>
            <Field
              label="BACKUP PASSPHRASE"
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="Enter passphrase..."
              secureTextEntry
            />
            <Button title="Decrypt & Preview" icon="key-outline" loading={busy} onPress={previewEncrypted} />
          </Card>
        )}

        {done && (
          <Card style={{ marginTop: 12, borderColor: c.ok }}>
            <Text style={{ color: c.ok, fontWeight: "800" }}>Import complete</Text>
            <Text style={{ color: c.text, marginTop: 4 }}>{done}</Text>
          </Card>
        )}

        {(parsed || encRaw) && summary && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: c.muted, marginBottom: 8 }}>
              {fileName} · detected {parsed ? parsed.detectedFormat : "SSE Vault Encrypted (.ssevault)"}
              {parsed.skippedMalformed ? ` · ${parsed.skippedMalformed} malformed rows skipped` : ""}
              {(parsed?.entries.length || 0) > 500 ? " · only the first 500 entries are imported at a time" : ""}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <StatBox icon="add-circle" label="New" value={summary.newCount} color={c.ok} />
              <StatBox icon="copy" label="Duplicates" value={summary.exactDuplicateCount} color={c.muted} />
              <StatBox icon="git-compare" label="Conflicts" value={summary.conflictCount} color={c.warn} />
              <StatBox icon="close-circle" label="Invalid" value={summary.invalidCount} color={c.danger} />
            </View>

            <Text style={{ color: c.muted, fontSize: 12, fontWeight: "700", marginTop: 18, marginBottom: 8 }}>WHEN AN ACCOUNT ALREADY EXISTS</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              <Chip label="Skip it" active={strategy === "skip"} onPress={() => changeStrategy("skip")} />
              <Chip label="Update it" active={strategy === "update"} onPress={() => changeStrategy("update")} />
              <Chip label="Keep both" active={strategy === "duplicate"} onPress={() => changeStrategy("duplicate")} />
            </View>

            <Button title={`Import ${summary.newCount + (strategy === "skip" ? 0 : summary.conflictCount)} entries`} icon="download-outline"
              onPress={commit} loading={busy} disabled={summary.total === 0} style={{ marginTop: 16 }} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
