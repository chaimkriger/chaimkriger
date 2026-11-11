import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import { can, type Permission, type RoleKey } from "./permissions";
import { SESSION_COOKIE, verifySession } from "./session";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: RoleKey;
}

/** The signed-in user, re-checked against the database on every request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class ForbiddenError extends Error {
  constructor() {
    super("Your role does not allow this action.");
  }
}

/** For server actions: throws when the user lacks the permission. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError();
  if (!can(user.role, permission)) throw new ForbiddenError();
  return user;
}
