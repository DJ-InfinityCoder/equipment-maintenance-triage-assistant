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
import { areDemoAccountsEnabled, DEMO_ACCOUNTS } from "../lib/auth/demo-accounts";

const originalAuthSecret = process.env.AUTH_SECRET;
const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;
const originalNodeEnv = process.env.NODE_ENV;
const originalDisableDemo = process.env.DISABLE_DEMO_ACCOUNTS;

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
    if (originalNodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV;
    else (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    if (originalDisableDemo === undefined) delete process.env.DISABLE_DEMO_ACCOUNTS;
    else process.env.DISABLE_DEMO_ACCOUNTS = originalDisableDemo;
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

  it("enables demo accounts by default even in production environment", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.DISABLE_DEMO_ACCOUNTS;
    expect(areDemoAccountsEnabled()).toBe(true);

    process.env.DISABLE_DEMO_ACCOUNTS = "true";
    expect(areDemoAccountsEnabled()).toBe(false);

    process.env.DISABLE_DEMO_ACCOUNTS = "false";
    expect(areDemoAccountsEnabled()).toBe(true);
  });

  it("defines standard demo accounts for evaluation", () => {
    expect(DEMO_ACCOUNTS.length).toBeGreaterThanOrEqual(2);

    const reporter = DEMO_ACCOUNTS.find((a) => a.role === "reporter");
    const technician = DEMO_ACCOUNTS.find((a) => a.role === "technician");

    expect(reporter).toBeDefined();
    expect(reporter?.email).toBe("reporter.demo@example.com");
    expect(reporter?.password).toBeTruthy();

    expect(technician).toBeDefined();
    expect(technician?.email).toBe("technician.demo@example.com");
    expect(technician?.password).toBeTruthy();
  });
});
