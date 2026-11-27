import React, { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVault, type AppGroup } from "../vault";
import { useAuth } from "../auth";
import { CATEGORIES, type Category } from "../types";
import { Banner, Chip, Empty, SiteIcon, StatBox } from "../ui";
import { UpdateNotice } from "../Update";
import { c, radius } from "../theme";

export default function Home({ onOpen, onOpenGroup, onAdd, onSecurity }: {
  onOpen: (id: string) => void; onOpenGroup: (domainKey: string) => void;
  onAdd: () => void; onSecurity: () => void;
}) {
  const { items, groups, loading, error, refresh } = useVault();
  const { user, offline } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all" | "fav">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => {
          if (cat === "fav" && !i.favorite) return false;
          if (cat !== "all" && cat !== "fav" && i.category !== cat) return false;
          if (!needle) return true;
          return [i.label, i.appName, i.domainKey, i.email, i.username]
            .some((v) => (v || "").toLowerCase().includes(needle));
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q, cat]);

  const totp = items.filter((i) => i.totpSecret).length;
  const favs = items.filter((i) => i.favorite).length;
  const problems = items.filter((i) => i.decryptionStatus !== "ok").length;

  const header = (
    <View>
      <Text style={{ color: c.muted, fontSize: 14 }}>Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}</Text>
      <Text style={{ color: c.text, fontSize: 30, fontWeight: "900", marginBottom: 14 }}>My Vault</Text>
      <UpdateNotice />
      {problems > 0 && !offline ? (
        <Banner icon="warning-outline" color={c.danger} title={`${problems} entr${problems === 1 ? "y needs" : "ies need"} attention`}
          body="Some data was recovered or couldn't be decrypted with the current key." action="Open Security check" onAction={onSecurity} />
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        <StatBox icon="key" label="Accounts" value={items.length} color={c.accent} />
        <StatBox icon="timer-outline" label="2FA" value={totp} color={c.ok} />
        <StatBox icon="star" label="Favorites" value={favs} color={c.info} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.card, borderRadius: radius.md,
        borderWidth: 1, borderColor: c.border, paddingHorizontal: 12 }}>
        <Ionicons name="search" size={18} color={c.faint} />
        <TextInput value={q} onChangeText={setQ} placeholder={`Search ${groups.length} apps and ${items.length} accounts`}
          placeholderTextColor={c.faint} autoCapitalize="none" autoCorrect={false}
          style={{ flex: 1, color: c.text, paddingVertical: 12, paddingHorizontal: 8, fontSize: 15 }} />
        {q ? <Ionicons name="close-circle" size={18} color={c.faint} onPress={() => setQ("")} /> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
        <Chip label="All" active={cat === "all"} onPress={() => setCat("all")} />
        <Chip label="★ Favorites" active={cat === "fav"} onPress={() => setCat("fav")} />
        {CATEGORIES.map((k) => (
          <Chip key={k.id} label={k.label} color={k.color} active={cat === k.id} onPress={() => setCat(k.id)} />
        ))}
      </ScrollView>
      {error ? <Text style={{ color: c.danger, textAlign: "center", padding: 8 }}>{error}</Text> : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={(g) => g.domainKey}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.accent} />}
        ListEmptyComponent={loading ? null : (
          <Empty icon="key-outline" title={items.length ? "No matches" : "Your vault is empty"}
            body={items.length ? "Try a different search or filter." : "Tap + to add your first login."} />
        )}
        renderItem={({ item: g }) => (
          <GroupRow group={g} onPress={() => (g.items.length === 1 ? onOpen(g.items[0].id) : onOpenGroup(g.domainKey))} />
        )}
      />
      {!offline && (
        <Pressable onPress={onAdd} style={({ pressed }) => ({ position: "absolute", right: 20, bottom: 24,
          width: 60, height: 60, borderRadius: 20, backgroundColor: c.accent, alignItems: "center",
          justifyContent: "center", opacity: pressed ? 0.85 : 1, elevation: 6 })}>
          <Ionicons name="add" size={30} color={c.accentText} />
        </Pressable>
      )}
    </View>
  );
}

function GroupRow({ group, onPress }: { group: AppGroup; onPress: () => void }) {
  const its = group.items;
  const single = its.length === 1 ? its[0] : null;
  const oauth = its.filter((i) => i.authType === "oauth").length;
  const totp = its.filter((i) => i.totpSecret).length;
  const codes = its.reduce((n, i) => n + i.securityCodes.filter((k) => !k.used).length, 0);
  const fav = its.some((i) => i.favorite);
  const bad = its.some((i) => i.decryptionStatus !== "ok");
  const cat = CATEGORIES.find((k) => k.id === its[0].category);
  const sub = single ? single.email || single.username || group.domainKey : `${its.length} accounts · ${group.domainKey}`;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12,
      padding: 12, marginBottom: 8, borderRadius: radius.lg, backgroundColor: pressed ? c.card2 : c.card,
      borderWidth: 1, borderColor: c.border })}>
      <SiteIcon domain={group.domainKey} name={group.appName} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>
          {single ? single.label : group.appName}
        </Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{sub}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {fav && <Ionicons name="star" size={14} color={c.accent} />}
          {oauth > 0 && <Ionicons name="link" size={14} color={c.muted} />}
          {totp > 0 && <Ionicons name="timer-outline" size={15} color={c.ok} />}
          {codes > 0 && <Ionicons name="key-outline" size={14} color={c.muted} />}
          {bad && <Ionicons name="warning" size={14} color={c.danger} />}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {!single && (
            <View style={{ backgroundColor: c.accent + "26", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
              <Text style={{ color: c.accent, fontSize: 12, fontWeight: "800" }}>{its.length}</Text>
            </View>
          )}
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat?.color || c.faint }} />
        </View>
      </View>
    </Pressable>
  );
}
