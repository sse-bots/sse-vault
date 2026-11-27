import { getAccountsBaseUrl, getSession } from "./auth";

export interface VaultUserSession {
  userId: string;
  name: string;
  username: string | null;
  email: string;
  image: string | null;
  discordId: string | null;
  sseRole: string;
  accountsUrl: string;
}

export async function getVaultSession(): Promise<VaultUserSession | null> {
  const session = await getSession();
  if (!session?.user?.sub) return null;

  return {
    userId: session.user.sub,
    name: session.user.name || "SSE User",
    username: session.user.username,
    email: session.user.email || "",
    image: session.user.image,
    discordId: session.user.discordId,
    sseRole: session.user.sseRole || "member",
    accountsUrl: getAccountsBaseUrl(),
  };
}
