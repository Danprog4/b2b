import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { authSessions, users } from "@/db/schema";

export const SESSION_COOKIE_NAME = "city_market_session";

export type UserRole = "buyer" | "seller" | "admin";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  status: "active" | "blocked" | "pending_join";
  buyerCompanyId: string | null;
  sellerId: string | null;
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  await db.insert(authSessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db
      .delete(authSessions)
      .where(eq(authSessions.tokenHash, hashSessionToken(token)));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const [sessionUser] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      buyerCompanyId: users.buyerCompanyId,
      sellerId: users.sellerId,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, hashSessionToken(token)),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return sessionUser ?? null;
}

export async function requireUser(allowedRoles?: UserRole[]) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.status !== "active") {
    redirect("/login?error=inactive");
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    redirect("/");
  }

  return currentUser;
}
