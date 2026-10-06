import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertAuthConfigured,
  createPasswordHash,
  hashPassword,
  SessionUser,
  signSession,
  verifyPassword,
  verifySessionToken,
} from "../lib/auth/session";

const originalAuthSecret = process.env.AUTH_SECRET;
const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

describe("authentication session helpers", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-only-auth-secret-with-more-than-32-characters";
    delete process.env.NEXTAUTH_SECRET;
  });

  afterEach(() => {
    if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuthSecret;
    if (originalNextAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
  });

  it("signs and verifies a session with its role and identity", async () => {
    const user: SessionUser = {
      id: "user-1",
      name: "Operator",
      email: "operator@example.test",
      role: "reporter",
    };

    await expect(verifySessionToken(await signSession(user))).resolves.toEqual(user);
  });

  it("rejects an unset or short session secret", () => {
    delete process.env.AUTH_SECRET;
    expect(() => assertAuthConfigured()).toThrow(/AUTH_SECRET/);

    process.env.AUTH_SECRET = "short";
    expect(() => assertAuthConfigured()).toThrow(/AUTH_SECRET/);
  });

  it("verifies password hashes without accepting a different password", () => {
    const credentials = createPasswordHash("a-secure-password");

    expect(verifyPassword("a-secure-password", credentials.salt, credentials.hash)).toBe(true);
    expect(verifyPassword("incorrect-password", credentials.salt, credentials.hash)).toBe(false);
    expect(hashPassword("a-secure-password", credentials.salt)).toBe(credentials.hash);
  });
});
