import crypto from "node:crypto";
import { getUsersCollection, UserDoc } from "@/lib/db/collections";
import { DatabaseError } from "@/lib/schemas/errors";
import { AppUser, UserRole } from "@/lib/schemas/user";
import { stripMongoId } from "@/lib/db/repos/utils";

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const usersColl = await getUsersCollection();
  const doc = await usersColl.findOne({ email: email.trim().toLowerCase() });
  return doc ? (stripMongoId(doc) as AppUser) : null;
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const usersColl = await getUsersCollection();
  const doc = await usersColl.findOne({ id });
  return doc ? (stripMongoId(doc) as AppUser) : null;
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
}): Promise<AppUser> {
  const usersColl = await getUsersCollection();
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await usersColl.findOne({ email: normalizedEmail });

  if (existing) {
    throw new DatabaseError("A user already exists with that email address.", {
      userMessage: "An account with this email already exists.",
      statusCode: 409,
    });
  }

  const userId = `user_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const doc: UserDoc = {
    id: userId,
    name: input.name.trim(),
    email: normalizedEmail,
    role: input.role,
    passwordHash: input.passwordHash,
    passwordSalt: input.passwordSalt,
    createdAt: now,
    updatedAt: now,
  };

  await usersColl.insertOne(doc);
  return stripMongoId(doc) as AppUser;
}

export async function ensureUsersIndex(): Promise<void> {
  try {
    const usersColl = await getUsersCollection();
    await usersColl.createIndex({ email: 1 }, { unique: true });
  } catch (error) {
    throw new DatabaseError("Failed to prepare user collection indexes.", {
      userMessage: "User authentication indexes could not be prepared.",
      cause: error,
    });
  }
}
