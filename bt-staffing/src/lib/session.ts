import { SignJWT, jwtVerify } from "jose";

// Edge-safe (used by middleware): no database, no Node-only APIs.
export const SESSION_COOKIE = "bt_session";
export const SESSION_HOURS = 12;

export interface SessionPayload {
  sub: string;
  role: "RECRUITER" | "OFFSHORE_RECRUITER" | "ADMIN";
  name: string;
}

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set to at least 32 characters");
    }
    return new TextEncoder().encode("dev-only-secret-dev-only-secret-dev-only");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: payload.role as SessionPayload["role"], name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}
