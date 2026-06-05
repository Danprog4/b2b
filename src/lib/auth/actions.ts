"use server";

import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  buyerCompanies,
  companyJoinRequests,
  users,
} from "@/db/schema";
import { createSession, destroyCurrentSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { mergeGuestCartIntoUserCart } from "@/lib/cart/merge";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getSafeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  if (value.startsWith("/login") || value.startsWith("/register")) {
    return null;
  }

  return value;
}

async function getPendingCompanyJoinRequest(userId: string) {
  const [request] = await db
    .select({ id: companyJoinRequests.id })
    .from(companyJoinRequests)
    .where(
      and(
        eq(companyJoinRequests.userId, userId),
        eq(companyJoinRequests.status, "pending"),
      ),
    )
    .limit(1);

  return request;
}

async function getLatestCompanyJoinRequest(userId: string) {
  const [request] = await db
    .select({
      id: companyJoinRequests.id,
      status: companyJoinRequests.status,
    })
    .from(companyJoinRequests)
    .where(eq(companyJoinRequests.userId, userId))
    .orderBy(desc(companyJoinRequests.createdAt))
    .limit(1);

  return request;
}

export async function loginAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const nextPath = getSafeNextPath(getString(formData, "next"));

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=invalid");
  }

  if (user.status !== "active") {
    if (user.role === "buyer" && user.status === "pending_join") {
      const pendingRequest = await getPendingCompanyJoinRequest(user.id);

      if (pendingRequest) {
        redirect("/login?pending=company");
      }

      const latestRequest = await getLatestCompanyJoinRequest(user.id);

      if (latestRequest?.status === "rejected") {
        redirect("/register?retry=company");
      }
    }

    redirect("/login?error=inactive");
  }

  await createSession(user.id);
  await mergeGuestCartIntoUserCart(user.id);

  if (nextPath) {
    redirect(nextPath);
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  if (user.role === "seller") {
    redirect("/seller");
  }

  redirect("/account");
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/");
}

export async function registerBuyerAction(formData: FormData) {
  const companyType = getString(formData, "companyType");
  const inn = getString(formData, "inn");
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const name = getString(formData, "name");
  const phone = getString(formData, "phone");
  const companyName = getString(formData, "companyName");
  const kpp = getString(formData, "kpp");
  const ogrn = getString(formData, "ogrn");
  const directorName = getString(formData, "directorName");
  const legalAddress = getString(formData, "legalAddress");

  if (!email || !password || !inn || !companyName || !phone) {
    redirect("/register?error=required");
  }

  if (password.length < 8) {
    redirect("/register?error=password");
  }

  const [existingUser] = await db
    .select({
      id: users.id,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let canReusePendingUser = false;

  if (existingUser) {
    if (existingUser.role !== "buyer" || existingUser.status !== "pending_join") {
      redirect("/register?error=email");
    }

    const pendingRequest = await getPendingCompanyJoinRequest(existingUser.id);

    if (pendingRequest) {
      redirect("/login?pending=company");
    }

    const latestRequest = await getLatestCompanyJoinRequest(existingUser.id);

    if (latestRequest?.status !== "rejected") {
      redirect("/register?error=email");
    }

    canReusePendingUser = true;
  }

  const [existingCompany] = await db
    .select()
    .from(buyerCompanies)
    .where(eq(buyerCompanies.inn, inn))
    .limit(1);

  if (existingCompany) {
    if (existingUser && canReusePendingUser) {
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            name,
            phone,
            passwordHash: hashPassword(password),
            status: "pending_join",
            buyerCompanyId: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));

        await tx.insert(companyJoinRequests).values({
          userId: existingUser.id,
          buyerCompanyId: existingCompany.id,
        });
      });

      redirect("/login?pending=company&resubmitted=1");
    }

    const [pendingUser] = await db
      .insert(users)
      .values({
        name,
        email,
        phone,
        passwordHash: hashPassword(password),
        role: "buyer",
        status: "pending_join",
      })
      .returning();

    await db.insert(companyJoinRequests).values({
      userId: pendingUser.id,
      buyerCompanyId: existingCompany.id,
    });

    redirect("/login?pending=company");
  }

  if (existingUser && canReusePendingUser) {
    await db.transaction(async (tx) => {
      const [company] = await tx
        .insert(buyerCompanies)
        .values({
          type: companyType === "ip" ? "ip" : "ooo",
          name: companyName,
          inn,
          kpp: kpp || null,
          ogrn: ogrn || null,
          directorName: directorName || null,
          legalAddress: legalAddress || null,
          contactEmail: email,
          contactPhone: phone,
        })
        .returning({ id: buyerCompanies.id });

      await tx
        .update(users)
        .set({
          name,
          phone,
          passwordHash: hashPassword(password),
          role: "buyer",
          status: "active",
          buyerCompanyId: company.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
    });

    await createSession(existingUser.id);
    await mergeGuestCartIntoUserCart(existingUser.id);
    redirect("/account");
  }

  const [company] = await db
    .insert(buyerCompanies)
    .values({
      type: companyType === "ip" ? "ip" : "ooo",
      name: companyName,
      inn,
      kpp: kpp || null,
      ogrn: ogrn || null,
      directorName: directorName || null,
      legalAddress: legalAddress || null,
      contactEmail: email,
      contactPhone: phone,
    })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      phone,
      passwordHash: hashPassword(password),
      role: "buyer",
      status: "active",
      buyerCompanyId: company.id,
    })
    .returning();

  await createSession(user.id);
  await mergeGuestCartIntoUserCart(user.id);
  redirect("/account");
}
