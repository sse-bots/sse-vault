import { headers } from "next/headers";
import type { Document, Filter } from "mongodb";
import { auth } from "./auth";
import { getMongoClient, getVaultCollections, userDocMatch } from "./mongodb";
import { getPublicSseAccountsUrl } from "./sse-sso";

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
  await getMongoClient();

  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) return null;

  const { authUsers } = await getVaultCollections();
  const userDoc = await authUsers.findOne(
    userDocMatch(session.user.id) as unknown as Filter<Document>
  );
  const rec = session.user as unknown as Record<string, unknown>;

  return {
    userId: session.user.id,
    name: String(userDoc?.name || session.user.name || "SSE User"),
    username:
      typeof userDoc?.username === "string"
        ? userDoc.username
        : typeof rec.username === "string"
          ? rec.username
          : null,
    email: String(userDoc?.email || session.user.email || ""),
    image: (userDoc?.image as string | null) ?? session.user.image ?? null,
    discordId:
      typeof userDoc?.discordId === "string"
        ? userDoc.discordId
        : typeof rec.discordId === "string"
          ? rec.discordId
          : null,
    sseRole: String(userDoc?.sseRole || rec.sseRole || "member"),
    accountsUrl: getPublicSseAccountsUrl(),
  };
}
