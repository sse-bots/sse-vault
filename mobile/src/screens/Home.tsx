import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Alert } from "react-native";
import { api } from "../api";
import { useVault, type AppGroup } from "../vault";
import { useAuth } from "../auth";
import { usePrefs } from "../prefs";
import { CATEGORIES, type Category } from "../types";
import { Banner, Chip, Empty, SiteIcon, StatBox } from "../ui";
import { UpdateNotice } from "../Update";
import { c, radius } from "../theme";

type AppFilter = "all" | "oauth" | "totp" | "keys" | "notes" | "cards" | "favorites";
type SortMode = "favorites" | "accounts" | "recent" | "az";

const SORT_CYCLE: { id: SortMode; label: string }[] = [
  { id: "favorites", label: "Sort: Favorites" },
  { id: "accounts", label: "Sort: Most Accounts" },
  { id: "recent", label: "Sort: Recent" },
  { id: "az", label: "Sort: A–Z" },
];

export default function Home({
  onOpenGroup,
  onAdd,
  onSecurity,
  onAuthTab,
  onTrash,
}: {
  onOpen: (id: string) => void;
  onOpenGroup: (domainKey: string) => void;
  onAdd: () => void;
  onSecurity: () => void;
  onAuthTab: () => void;
  onTrash: () => void;
}) {
  const { items, groups, loading, error, refresh } = useVault();
  const { user, offline } = useAuth();
  const { privacyBlur, setPrivacyBlur } = usePrefs();

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<AppFilter>("all");
  const [cat, setCat] = useState<Category | "all">("all");
  const [sortBy, setSortBy] = useState<SortMode>("favorites");
  const [compact, setCompact] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = groups.filter((g) => {
      const its = g.items;
      if (filter === "oauth" && !its.some((i) => i.authType === "oauth"))
        return false;
      if (filter === "totp" && !its.some((i) => Boolean(i.totpSecret)))
        return false;
      if (filter === "keys" && !its.some((i) => i.securityCodes.length > 0))
        return false;
      if (filter === "notes" && !its.some((i) => i.entryType === "note")) return false;
      if (filter === "cards" && !its.some((i) => i.entryType === "card")) return false;
      if (filter === "favorites" && !its.some((i) => i.favorite)) return false;
      if (cat !== "all" && !its.some((i) => i.category === cat)) return false;
      if (!needle) return true;
      return (
        g.appName.toLowerCase().includes(needle) ||
        g.domainKey.toLowerCase().includes(needle) ||
        its.some((i) =>
          [i.label, i.email, i.username, i.oauthProvider].some((v) =>
            (v || "").toLowerCase().includes(needle)
          )
        )
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === "az") return a.appName.localeCompare(b.appName);
      if (sortBy === "accounts")
        return (
          b.items.length - a.items.length ||
          a.appName.localeCompare(b.appName)
        );
      if (sortBy === "recent") {
        const aMax = a.items.reduce(
          (m, i) => (i.updatedAt > m ? i.updatedAt : m),
          ""
        );
        const bMax = b.items.reduce(
          (m, i) => (i.updatedAt > m ? i.updatedAt : m),
          ""
        );
        return bMax.localeCompare(aMax);
      }
      const aFav = a.items.some((i) => i.favorite) ? 1 : 0;
      const bFav = b.items.some((i) => i.favorite) ? 1 : 0;
      return (
        bFav - aFav ||
        b.items.length - a.items.length ||
        a.appName.localeCompare(b.appName)
      );
    });
  }, [groups, q, filter, cat, sortBy]);

  const totpCount = items.filter((i) => Boolean(i.totpSecret)).length;
  const unusedKeys = items.reduce(
    (sum, i) => sum + i.securityCodes.filter((k) => !k.used).length,
    0
  );
  const problems = items.filter((i) => i.decryptionStatus !== "ok").length;

  const currentSortLabel =
    SORT_CYCLE.find((s) => s.id === sortBy)?.label || "Sort: Favorites";

  const cycleSort = () => {
    const idx = SORT_CYCLE.findIndex((s) => s.id === sortBy);
    setSortBy(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length].id);
  };

  const header = (
    <View>
      {/* Existing App Header — kept untouched! */}
      <Text style={{ color: c.muted, fontSize: 14 }}>
        Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}
      </Text>
      <Text
        style={{
          color: c.text,
          fontSize: 30,
          fontWeight: "900",
          marginBottom: 14,
        }}
      >
        My Vault
      </Text>

      <UpdateNotice />

      {problems > 0 && !offline ? (
        <Banner
          icon="warning-outline"
          color={c.danger}
          title={`${problems} entr${problems === 1 ? "y needs" : "ies need"} attention`}
          body="Some data was recovered or couldn't be decrypted with the current key."
          action="Open Security check"
          onAction={onSecurity}
        />
      ) : null}

      {/* 2x2 Bento Stats Strip (Exact Website Match!) */}
      <View style={{ gap: 8, marginBottom: 14 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatBox
            icon="grid-outline"
            label="Apps / Sites"
            value={groups.length}
            color={c.muted}
          />
          <StatBox
            icon="people-outline"
            label="Accounts"
            value={items.length}
            color={c.muted}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatBox
            icon="phone-portrait-outline"
            label="Live TOTP"
            value={totpCount}
            color={c.info}
            onPress={onAuthTab}
          />
          <StatBox
            icon="key-outline"
            label="Unused Keys"
            value={unusedKeys}
            color={c.accentLabel}
            onPress={onSecurity}
          />
        </View>
      </View>

      {/* Search Bar + Privacy Blur Quick Toggle */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.borderStrong,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search" size={17} color={c.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search apps (Google, GitHub...) or email..."
            placeholderTextColor={c.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              color: c.text,
              paddingVertical: 11,
              paddingHorizontal: 8,
              fontSize: 14,
            }}
          />
          {q ? (
            <Pressable onPress={() => setQ("")}>
              <Ionicons name="close-circle" size={17} color={c.faint} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => setPrivacyBlur(!privacyBlur)}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: privacyBlur ? c.accentSoft : c.card,
            borderWidth: 1,
            borderColor: privacyBlur ? c.accent : c.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={privacyBlur ? "eye-outline" : "eye-off-outline"}
            size={19}
            color={privacyBlur ? c.accentLabel : c.muted}
          />
        </Pressable>
      </View>

      {/* Website-Matching Filter Pills + Sort + Compact Toggle */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 12 }}
        contentContainerStyle={{ alignItems: "center", gap: 6, paddingRight: 8 }}
      >
        <View
          style={{
            flexDirection: "row",
            backgroundColor: c.card2,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 999,
            padding: 3,
            gap: 2,
          }}
        >
          {(
            [
              { id: "all", label: "All" },
              { id: "oauth", label: "OAuth" },
              { id: "totp", label: "TOTP" },
              { id: "keys", label: "Keys" },
              { id: "notes", label: "Notes" },
              { id: "cards", label: "Cards" },
              { id: "favorites", label: "Favorites" },
            ] as const
          ).map((t) => {
            const active = filter === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setFilter(t.id)}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: active ? c.accent : "transparent",
                }}
              >
                <Text
                  style={{
                    color: active ? c.accentText : c.muted,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={cycleSort}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.borderStrong,
            borderRadius: 999,
            paddingHorizontal: 11,
            paddingVertical: 7,
          }}
        >
          <Ionicons name="swap-vertical" size={13} color={c.accentLabel} />
          <Text style={{ color: c.text, fontSize: 11, fontWeight: "700" }}>
            {currentSortLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setCompact((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.borderStrong,
            borderRadius: 999,
            paddingHorizontal: 11,
            paddingVertical: 7,
          }}
        >
          <Ionicons
            name={compact ? "grid-outline" : "list-outline"}
            size={13}
            color={c.muted}
          />
          <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700" }}>
            {compact ? "Cards" : "Compact"}
          </Text>
        </Pressable>

        {!offline && (
          <>
            <Pressable
              onPress={() => {
                setSelectMode((v) => !v);
                setSelectedDomains([]);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: selectMode ? c.accentSoft : c.card,
                borderWidth: 1,
                borderColor: selectMode ? c.accent : c.borderStrong,
                borderRadius: 999,
                paddingHorizontal: 11,
                paddingVertical: 7,
              }}
            >
              <Ionicons name="checkbox-outline" size={13} color={c.accentLabel} />
              <Text style={{ color: selectMode ? c.accentLabel : c.muted, fontSize: 11, fontWeight: "700" }}>
                {selectMode ? "Done" : "Select"}
              </Text>
            </Pressable>

            <Pressable
              onPress={onTrash}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.borderStrong,
                borderRadius: 999,
                paddingHorizontal: 11,
                paddingVertical: 7,
              }}
            >
              <Ionicons name="trash-outline" size={13} color={c.danger} />
              <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700" }}>
                Trash
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {selectMode && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.accentBorder,
            borderRadius: radius.lg,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginTop: 8,
            gap: 8,
          }}
        >
          <Text style={{ color: c.text, fontSize: 12, fontWeight: "800" }}>
            {selectedDomains.length} selected
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              disabled={selectedDomains.length === 0}
              onPress={() => {
                const ids = items.filter((i) => selectedDomains.includes(i.domainKey)).map((i) => i.id);
                if (!ids.length) return;
                Alert.alert("Move to Trash?", `Move ${ids.length} account(s) to the 30-day Trash Bin?`, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Move to Trash",
                    style: "destructive",
                    onPress: async () => {
                      await api.bulk({ action: "trash", ids });
                      setSelectedDomains([]);
                      setSelectMode(false);
                      await refresh();
                    },
                  },
                ]);
              }}
              style={{
                backgroundColor: c.danger + "22",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.sm,
                opacity: selectedDomains.length === 0 ? 0.4 : 1,
              }}
            >
              <Text style={{ color: c.danger, fontSize: 11, fontWeight: "800" }}>Trash Selected</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Category Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 8, marginBottom: 10 }}
      >
        <Chip
          label="All Categories"
          active={cat === "all"}
          onPress={() => setCat("all")}
        />
        {CATEGORIES.map((k) => (
          <Chip
            key={k.id}
            label={k.label}
            color={k.color}
            active={cat === k.id}
            onPress={() => setCat(k.id)}
          />
        ))}
      </ScrollView>

      {error ? (
        <Text style={{ color: c.danger, textAlign: "center", padding: 8 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={(g) => g.domainKey}
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 110,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={c.accent}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <Empty
              icon="shield-checkmark-outline"
              title={
                items.length
                  ? "No matching apps found"
                  : "Add your first app to SSE Vault"
              }
              body={
                items.length
                  ? "Try clearing your search or switching filter tabs."
                  : "Tap + to add any website URL — SSE Vault fetches its icon and segregates accounts automatically."
              }
            />
          )
        }
        renderItem={({ item: g }) => (
          <AppGroupCard
            group={g}
            compact={compact}
            privacyBlur={privacyBlur}
            onPress={() => {
              if (!selectMode) return onOpenGroup(g.domainKey);
              setSelectedDomains((prev) =>
                prev.includes(g.domainKey)
                  ? prev.filter((d) => d !== g.domainKey)
                  : [...prev, g.domainKey]
              );
            }}
          />
        )}
      />

      <Pressable
          onPress={onAdd}
          style={({ pressed }) => ({
            position: "absolute",
            right: 20,
            bottom: 24,
            width: 58,
            height: 58,
            borderRadius: radius.lg,
            backgroundColor: c.accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
            elevation: 6,
          })}
        >
          <Ionicons name="add" size={28} color={c.accentText} />
        </Pressable>
    </View>
  );
}

function AppGroupCard({
  group,
  compact,
  privacyBlur,
  onPress,
}: {
  group: AppGroup;
  compact: boolean;
  privacyBlur: boolean;
  onPress: () => void;
}) {
  const its = group.items;
  const oauthCount = its.filter((i) => i.authType === "oauth").length;
  const totpCount = its.filter((i) => Boolean(i.totpSecret)).length;
  const unusedCodes = its.reduce(
    (n, i) => n + i.securityCodes.filter((k) => !k.used).length,
    0
  );
  const totalCodes = its.reduce((n, i) => n + i.securityCodes.length, 0);
  const hasFav = its.some((i) => i.favorite);
  const hasBad = its.some((i) => i.decryptionStatus !== "ok");
  const identities = its
    .map((i) => i.email || i.username || i.label)
    .filter(Boolean)
    .slice(0, 2);

  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingHorizontal: 13,
          paddingVertical: 11,
          marginBottom: 8,
          borderRadius: radius.lg,
          backgroundColor: pressed ? c.card2 : c.card,
          borderWidth: 1,
          borderColor: c.border,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11, flex: 1 }}>
          <SiteIcon domain={group.domainKey} name={group.appName} size={38} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text
                numberOfLines={1}
                style={{ color: c.text, fontSize: 15, fontWeight: "800" }}
              >
                {group.appName}
              </Text>
              {hasFav && <Ionicons name="star" size={13} color={c.accent} />}
              {hasBad && <Ionicons name="warning" size={13} color={c.danger} />}
            </View>
            <Text
              numberOfLines={1}
              style={{ color: c.muted, fontSize: 11, fontFamily: "monospace" }}
            >
              {group.domainKey}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              backgroundColor: c.card2,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: c.text, fontSize: 10, fontWeight: "800" }}>
              {its.length} {its.length === 1 ? "Acct" : "Accts"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.faint} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? c.card2 : c.card,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.xl,
        padding: 15,
        marginBottom: 10,
        gap: 11,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            flex: 1,
          }}
        >
          <SiteIcon domain={group.domainKey} name={group.appName} size={46} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text
                numberOfLines={1}
                style={{ color: c.text, fontSize: 16, fontWeight: "800" }}
              >
                {group.appName}
              </Text>
              {hasFav && <Ionicons name="star" size={14} color={c.accent} />}
              {hasBad && <Ionicons name="warning" size={14} color={c.danger} />}
            </View>
            <Text
              numberOfLines={1}
              style={{
                color: c.muted,
                fontSize: 11,
                fontFamily: "monospace",
                marginTop: 2,
              }}
            >
              {group.domainKey}
            </Text>
          </View>
        </View>

        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: c.card2,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-forward" size={15} color={c.muted} />
        </View>
      </View>

      {identities.length > 0 && (
        <Text
          numberOfLines={1}
          style={{ color: c.muted, fontSize: 11, fontFamily: "monospace" }}
        >
          {privacyBlur
            ? "••••••••••"
            : `${identities.join(" · ")}${its.length > 2 ? ` +${its.length - 2} more` : ""}`}
        </Text>
      )}

      {/* Exact Website Footer Pills */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <View
          style={{
            backgroundColor: c.card2,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 3,
          }}
        >
          <Text style={{ color: c.text, fontSize: 10, fontWeight: "800" }}>
            {its.length} {its.length === 1 ? "Account" : "Accounts"}
          </Text>
        </View>

        {oauthCount > 0 && (
          <View
            style={{
              backgroundColor: "#8b5cf624",
              borderRadius: 999,
              paddingHorizontal: 9,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: "#a78bfa", fontSize: 10, fontWeight: "800" }}>
              {oauthCount} OAuth
            </Text>
          </View>
        )}

        {totpCount > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              backgroundColor: c.info + "24",
              borderRadius: 999,
              paddingHorizontal: 9,
              paddingVertical: 3,
            }}
          >
            <Ionicons name="phone-portrait-outline" size={10} color={c.info} />
            <Text style={{ color: c.info, fontSize: 10, fontWeight: "800" }}>
              {totpCount} TOTP
            </Text>
          </View>
        )}

        {totalCodes > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              backgroundColor:
                unusedCodes === 0 ? c.danger + "24" : c.accentSoft,
              borderRadius: 999,
              paddingHorizontal: 9,
              paddingVertical: 3,
            }}
          >
            <Ionicons
              name="key-outline"
              size={10}
              color={unusedCodes === 0 ? c.danger : c.accentLabel}
            />
            <Text
              style={{
                color: unusedCodes === 0 ? c.danger : c.accentLabel,
                fontSize: 10,
                fontWeight: "800",
              }}
            >
              {unusedCodes}/{totalCodes}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
