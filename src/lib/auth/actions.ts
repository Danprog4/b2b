"use server";

import { eq } from "drizzle-orm";
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

export async function loginAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const nextPath = getSafeNextPath(getString(formData, "next"));

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=invalid");
  }

  if (user.status !== "active") {
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
  const legalAddress = getString(formData, "legalAddress");

  if (!email || !password || !inn || !companyName || !phone) {
    redirect("/register?error=required");
  }

  if (password.length < 8) {
    redirect("/register?error=password");
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    redirect("/register?error=email");
  }

  const [existingCompany] = await db
    .select()
    .from(buyerCompanies)
    .where(eq(buyerCompanies.inn, inn))
    .limit(1);

  if (existingCompany) {
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

  const [company] = await db
    .insert(buyerCompanies)
    .values({
      type: companyType === "ip" ? "ip" : "ooo",
      name: companyName,
      inn,
      kpp: kpp || null,
      ogrn: ogrn || null,
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
