import dns from "node:dns";
import "./load-env";
import { areDemoAccountsEnabled, DEMO_ACCOUNTS } from "../lib/auth/demo-accounts";
import { createPasswordHash } from "../lib/auth/session";
import { getUsersCollection } from "../lib/db/collections";
import { getMongoClientPromise } from "../lib/db/client";

async function main() {
  if (!areDemoAccountsEnabled()) {
    throw new Error("Demo accounts may only be seeded outside production.");
  }

  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch {
    // Use the operating system's configured DNS servers.
  }

  const client = await getMongoClientPromise();
  try {
    const users = await getUsersCollection();
    await users.createIndex({ email: 1 }, { unique: true });

    for (const account of DEMO_ACCOUNTS) {
      const { salt, hash } = createPasswordHash(account.password);
      const now = new Date().toISOString();

      await users.updateOne(
        { email: account.email },
        {
          $set: {
            name: account.name,
            email: account.email,
            role: account.role,
            passwordHash: hash,
            passwordSalt: salt,
            updatedAt: now,
          },
          $setOnInsert: {
            id: `user_demo_${account.role}`,
            createdAt: now,
          },
        },
        { upsert: true }
      );

      console.log(`Seeded local demo account: ${account.email} (${account.role})`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error("Could not seed local demo accounts.", error);
  process.exitCode = 1;
});
