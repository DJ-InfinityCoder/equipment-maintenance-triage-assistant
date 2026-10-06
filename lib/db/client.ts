import { MongoClient, Db } from "mongodb";
import dns from "node:dns";
import { DatabaseError } from "../schemas/errors";

function configureDnsServers(): void {
  const dnsServers = process.env.MONGODB_DNS_SERVERS?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (!dnsServers?.length) {
    return;
  }

  try {
    dns.setServers(dnsServers);
  } catch (error) {
    throw new DatabaseError("Invalid MongoDB DNS server configuration", {
      userMessage:
        "MongoDB DNS configuration is invalid. Check MONGODB_DNS_SERVERS in .env.local.",
      cause: error,
    });
  }
}

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new DatabaseError("MONGODB_URI environment variable is not defined", {
      userMessage: "Database connection string is missing. Please check .env.local configuration.",
    });
  }
  return uri;
}

export function getDefaultDbName(): string {
  return process.env.MONGODB_DB_NAME || "maintenance_triage";
}

declare global {
  // Prevent multiple MongoClient instances in dev during hot-reloads
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

/**
 * Creates a configured MongoClient instance that fails quickly when unavailable.
 */
export function createMongoClient(uri?: string): MongoClient {
  configureDnsServers();
  const connectionUri = uri || getMongoUri();
  return new MongoClient(connectionUri, {
    serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 3000,
    socketTimeoutMS: 10_000,
  });
}


export function getMongoClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    if (!globalThis._mongoClientPromise) {
      const client = createMongoClient();
      globalThis._mongoClientPromise = client.connect().catch((err) => {
        // Clear cached promise on connection error so subsequent attempts can retry
        delete globalThis._mongoClientPromise;
        throw new DatabaseError("Failed to connect to MongoDB server", {
          userMessage: "Database connection could not be established. Please verify database availability.",
          cause: err,
        });
      });
    }
    return globalThis._mongoClientPromise;
  }

  if (!clientPromise) {
    const client = createMongoClient();
    clientPromise = client.connect().catch((err) => {
      throw new DatabaseError("Failed to connect to MongoDB server", {
        userMessage: "Database connection could not be established. Please verify database availability.",
        cause: err,
      });
    });
  }

  return clientPromise;
}

import { isDebugFailActive } from "../services/debugFail";

/**
 * Returns a typed or connected Db instance.
 */
export async function getDb(dbName?: string): Promise<Db> {
  if (isDebugFailActive("db")) {
    throw new DatabaseError("Simulated MongoDB connection failure (DEBUG_FAIL=db)", {
      userMessage: "Database connection could not be established. Please verify database availability.",
    });
  }

  const targetDb = dbName || getDefaultDbName();
  try {
    const client = await getMongoClientPromise();
    return client.db(targetDb);
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError("Error accessing MongoDB database instance", {
      userMessage: "Database access error. Please check your connection.",
      cause: error,
    });
  }
}

/**
 * Fast ping check against MongoDB with strict timeout.
 */
export async function pingDb(dbName?: string): Promise<boolean> {
  if (isDebugFailActive("db")) {
    return false;
  }

  const targetDb = dbName || getDefaultDbName();
  try {
    const db = await getDb(targetDb);
    const result = await db.command({ ping: 1 });
    return result?.ok === 1;
  } catch {
    return false;
  }
}
