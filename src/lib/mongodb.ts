import { MongoClient, MongoClientOptions, Db, Document } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";

const uri = (process.env.MONGODB_URI || "mongodb://127.0.0.1:27017").trim();
const dbName = (process.env.MONGODB_DB_NAME || "sse_vault").trim();

declare global {
  // eslint-disable-next-line no-var
  var _sseVaultMongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var _sseVaultMongoConnectPromise: Promise<MongoClient> | undefined;
}

const options: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  serverSelectionTimeoutMS: 15_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 30_000,
  appName: "SSE-Vault-Web",
};

function createClient(): MongoClient {
  const client = new MongoClient(uri, options);
  attachDatabasePool(client);
  return client;
}

export const mongoClient: MongoClient =
  globalThis._sseVaultMongoClient ??
  (globalThis._sseVaultMongoClient = createClient());

export async function getMongoClient(): Promise<MongoClient> {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.trim()) {
    throw new Error("MONGODB_URI is not set in environment variables.");
  }
  if (!globalThis._sseVaultMongoConnectPromise) {
    globalThis._sseVaultMongoConnectPromise = mongoClient
      .connect()
      .catch((err) => {
        globalThis._sseVaultMongoConnectPromise = undefined;
        throw err;
      });
  }
  return globalThis._sseVaultMongoConnectPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

export async function getVaultCollections() {
  const db = await getDb();
  return {
    db,
    vaultItems: db.collection<Document>("vault_items"),
    vaultPinConfigs: db.collection<Document>("vault_pin_configs"),
  };
}
