import crypto from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { UserRole } from "@/lib/schemas/user";

export const SESSION_COOKIE_NAME = "triage_session";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export class AuthConfigurationError extends Error {
  constructor() {
    super("Authentication is not configured. Set AUTH_SECRET to a random value of at least 32 characters.");
    this.name = "AuthConfigurationError";
  }
}

function getSecret(): Uint8Array {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new AuthConfigurationError();
  }
  return new TextEncoder().encode(value);
}

export function assertAuthConfigured(): void {
  getSecret();
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setIssuer("equipment-maintenance-triage")
    .setAudience("equipment-maintenance-triage-app")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: "equipment-maintenance-triage",
      audience: "equipment-maintenance-triage-app",
    });
    const role = payload.role;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      (role !== "reporter" && role !== "technician")
    ) {
      return null;
    }

    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role,
    };
  } catch (error) {
    if (error instanceof AuthConfigurationError) throw error;
    return null;
  }
}

export async function readSessionFromCookieStore(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function readSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function setSessionCookie(response: Response, user: SessionUser): Promise<void> {
  return Promise.resolve().then(async () => {
    const token = await signSession(user);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const cookie = `triage_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure}`;
    response.headers.append("Set-Cookie", cookie);
  });
}

export function clearSessionCookie(response: Response): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
}

export function hashPassword(password: string, salt: string): string {
  const derived = crypto.scryptSync(password, Buffer.from(salt, "hex"), 64);
  return derived.toString("hex");
}

export function createPasswordHash(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: hashPassword(password, salt) };
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const actualHash = Buffer.from(hashPassword(password, salt), "hex");
  const expectedHash = Buffer.from(storedHash, "hex");
  return actualHash.length === expectedHash.length &&
    crypto.timingSafeEqual(actualHash, expectedHash);
}
