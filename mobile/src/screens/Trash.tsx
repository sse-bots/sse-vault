import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { api } from "../api";
import { useVault } from "../vault";
import type { TrashedItem } from "../types";
import { Button, Card, Empty, IconButton, SiteIcon, Toast, useToast } from "../ui";
import { c } from "../theme";

export default function Trash({ onBack }: { onBack: () => void }) {
  const { refresh } = useVault();
  const toast = useToast();
  const [list, setList] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await api.trashList());
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (id: string) => {
    setBusyId(id);
    try {
      await api.trashAction({ action: "restore", id });
      setList((p) => p.filter((x) => x.id !== id));
      await refresh();
      toast.show("Restored to vault");
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const deleteForever = (item: TrashedItem) => {
    Alert.alert("Delete permanently?", `"${item.label}" cannot be recovered after this.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusyId(item.id);
          try {
            await api.trashAction({ action: "delete", id: item.id });
            setList((p) => p.filter((x) => x.id !== item.id));
            toast.show("Deleted forever");
          } catch (e) {
            Alert.alert("Error", (e as Error).message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const emptyTrash = () => {
    Alert.alert("Empty Trash?", `Permanently delete all ${list.length} trashed item(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Empty Trash",
        style: "destructive",
        onPress: async () => {
          setBusyId("empty");
          try {
            await api.trashAction({ action: "empty" });
            setList([]);
            toast.show("Trash emptied");
          } catch (e) {
            Alert.alert("Error", (e as Error).message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
        <IconButton icon="chevron-back" onPress={onBack} label="Back" />
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" }}>
          Trash Bin
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
        ListHeaderComponent={
          list.length > 0 ? (
            <Button
              title={`Empty Trash (${list.length})`}
              icon="trash-outline"
              variant="danger"
              loading={busyId === "empty"}
              onPress={emptyTrash}
              style={{ marginBottom: 6, height: 42 }}
            />
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <Empty
              icon="trash-outline"
              title="Trash is empty"
              body="Deleted logins, notes, and cards stay recoverable here for 30 days."
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <SiteIcon domain={item.domainKey} name={item.appName} size={42} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, fontWeight: "800" }}>
                  {item.label}
                </Text>
                <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12 }}>
                  {item.email || item.username || item.domainKey}
                </Text>
                <Text style={{ color: c.danger, fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                  {item.daysRemaining} day{item.daysRemaining === 1 ? "" : "s"} left before permanent delete
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                title="Restore"
                icon="refresh"
                loading={busyId === item.id}
                onPress={() => void restore(item.id)}
                style={{ flex: 1, height: 40 }}
              />
              <Button
                title="Delete"
                variant="danger"
                onPress={() => deleteForever(item)}
                style={{ flex: 1, height: 40 }}
              />
            </View>
          </Card>
        )}
      />
      <Toast message={toast.msg} />
    </View>
  );
}
