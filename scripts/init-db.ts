import { MongoClient } from "mongodb";
import dns from "node:dns";
import "./load-env";
import { ensureIndexes } from "../lib/db/indexes";

// Ensure reliable SRV lookup on Windows
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // fallback to system default
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "maintenance_triage";

async function main() {
  if (!uri) {
    throw new Error("MONGODB_URI is required; set it in .env.local.");
  }

  console.log("Connecting to MongoDB Atlas Cluster0...");
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
    console.log("Successfully connected to MongoDB Cluster0!");

    const db = client.db(dbName);
    console.log(`Initializing database '${dbName}' and ensuring indexes...`);

    await ensureIndexes(db);
    console.log("Indexes and collections created successfully:");
    console.log(" - kb_chunks (text search, equipmentType, unique chunkId)");
    console.log(" - triage_records (equipmentId + createdAt desc, unique id)");
    console.log(" - work_orders (status, unique id, triageRecordId)");
    console.log(" - audit_events (entityId + timestamp desc)");
    console.log(" - equipment (unique equipmentId)");

    const collections = await db.listCollections().toArray();
    console.log(
      "Current collections in database:",
      collections.map((c) => c.name)
    );

    console.log("\nDatabase setup complete!");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
