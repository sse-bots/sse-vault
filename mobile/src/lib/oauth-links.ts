import { extractDomainKey, getAppNameForDomain } from "./domain";
import { OAUTH_PROVIDER_PRESETS, type VaultItem } from "../types";

export interface OAuthProviderOption {
  domain: string;
  name: string;
  accounts: VaultItem[];
  isBuiltIn: boolean;
}

function norm(val?: string | null): string {
  return (val || "").trim().toLowerCase();
}

export function getAccountTitle(item: VaultItem): string {
  if (item.label && item.label !== item.appName) return item.label;
  return item.username || item.email || item.appName;
}

export function resolveOAuthProviderDomain(
  item: Pick<VaultItem, "oauthProvider" | "oauthProviderDomain">
): string {
  if (item.oauthProviderDomain && item.oauthProviderDomain.trim()) {
    return (
      extractDomainKey(item.oauthProviderDomain) ||
      item.oauthProviderDomain.trim().toLowerCase()
    );
  }

  const prov = norm(item.oauthProvider);
  if (!prov) return "";

  const preset = OAUTH_PROVIDER_PRESETS.find(
    (p) => norm(p.name) === prov || norm(p.domain) === prov
  );
  if (preset) return preset.domain;

  if (prov === "google" || prov === "gmail") return "google.com";
  if (prov === "github") return "github.com";
  if (prov === "discord") return "discord.com";
  if (prov === "microsoft" || prov === "outlook") return "microsoft.com";
  if (prov === "apple" || prov === "icloud") return "apple.com";
  if (prov === "x" || prov === "twitter") return "x.com";
  if (prov === "facebook") return "facebook.com";
  if (prov === "gitlab") return "gitlab.com";
  if (prov === "steam") return "steampowered.com";
  if (prov === "twitch") return "twitch.tv";
  if (prov.includes("sse")) return "sse-account.vercel.app";

  if (prov.includes(".")) {
    return extractDomainKey(prov) || prov;
  }
  return "";
}

export function findParentOAuthAccount(
  child: VaultItem,
  allItems: VaultItem[]
): VaultItem | null {
  if (child.authType !== "oauth") return null;

  if (child.oauthLinkedItemId) {
    const exact = allItems.find((i) => i.id === child.oauthLinkedItemId);
    if (exact && exact.id !== child.id) return exact;
  }

  const providerDomain = resolveOAuthProviderDomain(child);
  if (!providerDomain) return null;

  const childIdentity = norm(child.email);
  const candidates = allItems.filter(
    (i) => i.id !== child.id && norm(i.domainKey) === norm(providerDomain)
  );
  if (candidates.length === 0) return null;

  if (childIdentity) {
    const matched = candidates.find(
      (c) => norm(c.email) === childIdentity || norm(c.username) === childIdentity
    );
    if (matched) return matched;
  }

  return null;
}

export function getConnectedOAuthEntries(
  providerAccount: VaultItem,
  allItems: VaultItem[]
): VaultItem[] {
  const providerDomain = norm(providerAccount.domainKey);
  const providerEmail = norm(providerAccount.email);
  const providerUser = norm(providerAccount.username);

  return allItems.filter((item) => {
    if (item.id === providerAccount.id) return false;
    if (item.authType !== "oauth") return false;

    if (item.oauthLinkedItemId) {
      return item.oauthLinkedItemId === providerAccount.id;
    }

    const itemProvDomain = norm(resolveOAuthProviderDomain(item));
    if (!itemProvDomain || itemProvDomain !== providerDomain) return false;

    const itemEmail = norm(item.email);
    if (!itemEmail) return false;

    return (
      (providerEmail !== "" && itemEmail === providerEmail) ||
      (providerUser !== "" && itemEmail === providerUser)
    );
  });
}

export function buildOAuthProviderCatalog(
  allItems: VaultItem[],
  excludeDomain?: string | null,
  excludeItemId?: string | null
): OAuthProviderOption[] {
  const excludedDom = norm(excludeDomain);
  const map = new Map<string, OAuthProviderOption>();

  for (const preset of OAUTH_PROVIDER_PRESETS) {
    const d = norm(preset.domain);
    map.set(d, {
      domain: d,
      name: preset.name,
      accounts: [],
      isBuiltIn: true,
    });
  }

  for (const item of allItems) {
    if (excludeItemId && item.id === excludeItemId) continue;
    const d = norm(item.domainKey);
    if (!d) continue;

    let entry = map.get(d);
    if (!entry) {
      entry = {
        domain: d,
        name: item.appName || getAppNameForDomain(d),
        accounts: [],
        isBuiltIn: false,
      };
      map.set(d, entry);
    }
    entry.accounts.push(item);
  }

  return Array.from(map.values())
    .filter((opt) => !excludedDom || opt.domain !== excludedDom)
    .sort((a, b) => {
      const aHas = a.accounts.length > 0 ? 1 : 0;
      const bHas = b.accounts.length > 0 ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
      if (a.isBuiltIn !== b.isBuiltIn) return a.isBuiltIn ? -1 : 1;
      return b.accounts.length - a.accounts.length || a.name.localeCompare(b.name);
    });
}
