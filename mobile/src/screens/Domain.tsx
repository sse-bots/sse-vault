import React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVault } from "../vault";
import { useAuth } from "../auth";
import { Button, IconButton, SiteIcon } from "../ui";
import { c, radius } from "../theme";

export default function Domain({ domainKey, onBack, onOpen, onAdd }: {
  domainKey: string; onBack: () => void; onOpen: (id: string) => void; onAdd: (url: string) => void;
}) {
  const { groups } = useVault();
  const { offline } = useAuth();
  const group = groups.find((g) => g.domainKey === domainKey);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
        <IconButton icon="chevron-back" onPress={onBack} label="Back" />
      </View>
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <SiteIcon domain={domainKey} name={group?.appName || domainKey} size={64} />
        <Text style={{ color: c.text, fontSize: 24, fontWeight: "900", marginTop: 10 }}>{group?.appName || domainKey}</Text>
        <Text style={{ color: c.muted, marginTop: 2 }}>{domainKey} · {group?.items.length || 0} accounts</Text>
      </View>
      <FlatList
        data={group?.items || []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListFooterComponent={offline ? null : (
          <Button title="Add another account" icon="add" variant="ghost" onPress={() => onAdd(domainKey)} style={{ marginTop: 8 }} />
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center",
            gap: 12, padding: 14, marginBottom: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border,
            backgroundColor: pressed ? c.card2 : c.card })}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{item.label}</Text>
              <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>
                {item.authType === "oauth" ? `Sign in with ${item.oauthProvider || "OAuth"}` : item.email || item.username || "—"}
              </Text>
            </View>
            {item.favorite && <Ionicons name="star" size={15} color={c.accent} />}
            {item.totpSecret && <Ionicons name="timer-outline" size={16} color={c.ok} />}
            <Ionicons name="chevron-forward" size={18} color={c.faint} />
          </Pressable>
        )}
      />
    </View>
  );
}
