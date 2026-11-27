import React, { useEffect, useState } from "react";
import { Linking } from "react-native";
import { checkForUpdate, type UpdateInfo } from "./updates";
import { Banner } from "./ui";

let cached: { latest: UpdateInfo | null; hasUpdate: boolean; at: number } | null = null;

export function useUpdateCheck(force = 0) {
  const [state, setState] = useState(cached);
  useEffect(() => {
    if (!force && cached && Date.now() - cached.at < 6 * 3600_000) return;
    let alive = true;
    checkForUpdate().then((r) => {
      cached = { ...r, at: Date.now() };
      if (alive) setState(cached);
    });
    return () => { alive = false; };
  }, [force]);
  return state;
}

export function openUpdate(u: UpdateInfo) {
  Linking.openURL(u.apkUrl || u.pageUrl).catch(() => {});
}

export function UpdateNotice() {
  const st = useUpdateCheck();
  const [hidden, setHidden] = useState<string | null>(null);
  if (!st?.hasUpdate || !st.latest || hidden === st.latest.version) return null;
  return (
    <Banner
      icon="cloud-download-outline"
      title={`Update available · v${st.latest.version}`}
      body="A new version of SSE Vault is ready. Download it and tap the file to install over the current app."
      action="Download update"
      onAction={() => openUpdate(st.latest!)}
      onClose={() => setHidden(st.latest!.version)}
    />
  );
}
