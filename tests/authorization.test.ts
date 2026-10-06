import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { authorizeRequest } from "../lib/auth/authorization";
import { signSession } from "../lib/auth/session";

const originalAuthSecret = process.env.AUTH_SECRET;
const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

describe("API role authorization", () => {
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

  it("rejects requests without a signed-in user", async () => {
    const request = new NextRequest("http://localhost/api/work-orders/test");

    const result = await authorizeRequest(request, ["technician"]);

    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.response.status).toBe(401);
  });

  it("denies a reporter access to technician-only endpoints", async () => {
    const token = await signSession({
      id: "reporter-1",
      name: "Reporter",
      email: "reporter@example.test",
      role: "reporter",
    });
    const request = new NextRequest("http://localhost/api/work-orders/test", {
      headers: { cookie: `triage_session=${token}` },
    });

    const result = await authorizeRequest(request, ["technician"]);

    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.response.status).toBe(403);
  });
});
