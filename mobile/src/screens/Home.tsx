import React, { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVault } from "../vault";
import { CATEGORIES, type Category, type VaultItem } from "../types";
import { Chip, Empty, SiteIcon } from "../ui";
import { c, radius } from "../theme";

export default function Home({ onOpen, onAdd }: { onOpen: (id: string) => void; onAdd: () => void }) {
  const { items, loading, error, refresh } = useVault();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all" | "fav">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (cat === "fav" && !i.favorite) return false;
      if (cat !== "all" && cat !== "fav" && i.category !== cat) return false;
      if (!needle) return true;
      return [i.label, i.appName, i.domainKey, i.email, i.username]
        .some((v) => (v || "").toLowerCase().includes(needle));
    });
  }, [items, q, cat]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: "800", marginBottom: 12 }}>Vault</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.card, borderRadius: radius.md,
          borderWidth: 1, borderColor: c.border, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={c.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder={`Search ${items.length} items`}
            placeholderTextColor={c.faint} autoCapitalize="none" autoCorrect={false}
            style={{ flex: 1, color: c.text, paddingVertical: 12, paddingHorizontal: 8, fontSize: 16 }} />
          {q ? <Ionicons name="close-circle" size={18} color={c.faint} onPress={() => setQ("")} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
          <Chip label="All" active={cat === "all"} onPress={() => setCat("all")} />
          <Chip label="★ Favorites" active={cat === "fav"} onPress={() => setCat("fav")} />
          {CATEGORIES.map((k) => (
            <Chip key={k.id} label={k.label} color={k.color} active={cat === k.id} onPress={() => setCat(k.id)} />
          ))}
        </ScrollView>
      </View>

      {error ? <Text style={{ color: c.danger, textAlign: "center", padding: 12 }}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.accent} />}
        ListEmptyComponent={loading ? null : (
          <Empty icon="key-outline" title={items.length ? "No matches" : "Your vault is empty"}
            body={items.length ? "Try a different search or filter." : "Tap + to add your first login."} />
        )}
        renderItem={({ item }) => <Row item={item} onPress={() => onOpen(item.id)} />}
      />

      <Pressable onPress={onAdd} style={({ pressed }) => ({ position: "absolute", right: 20, bottom: 24,
        width: 60, height: 60, borderRadius: 20, backgroundColor: c.accent, alignItems: "center",
        justifyContent: "center", opacity: pressed ? 0.85 : 1, elevation: 6 })}>
        <Ionicons name="add" size={30} color={c.accentText} />
      </Pressable>
    </View>
  );
}

function Row({ item, onPress }: { item: VaultItem; onPress: () => void }) {
  const cat = CATEGORIES.find((k) => k.id === item.category);
  const identity = item.email || item.username || item.domainKey;
  const unused = item.securityCodes.filter((k) => !k.used).length;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12,
      padding: 12, marginBottom: 8, borderRadius: radius.lg, backgroundColor: pressed ? c.card2 : c.card,
      borderWidth: 1, borderColor: c.border })}>
      <SiteIcon domain={item.domainKey} name={item.label} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{item.label}</Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{identity}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {item.favorite && <Ionicons name="star" size={14} color={c.accent} />}
          {item.authType === "oauth" && <Ionicons name="link" size={14} color={c.muted} />}
          {item.totpSecret && <Ionicons name="timer-outline" size={15} color={c.ok} />}
          {unused > 0 && <Ionicons name="key-outline" size={14} color={c.muted} />}
          {item.decryptionStatus !== "ok" && <Ionicons name="warning" size={14} color={c.danger} />}
        </View>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat?.color || c.faint }} />
      </View>
    </Pressable>
  );
}
