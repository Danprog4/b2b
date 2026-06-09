"use server";

import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  buyerCompanies,
  companyJoinRequests,
  emailOutbox,
  users,
} from "@/db/schema";
import { createSession, destroyCurrentSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { mergeGuestCartIntoUserCart } from "@/lib/cart/merge";
import { normalizeInn } from "@/lib/company-normalize";
import { getCompanyMissingFields } from "@/lib/account/company-validation";
import { generateBuyerCompanyContract } from "@/lib/contracts/generation";
import { insertAdminNotifications } from "@/lib/notifications/helpers";

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

type AuthTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function notifyAdminsAboutCompanyJoinRequest(
  tx: AuthTransaction,
  values: {
    buyerCompanyId: string;
    companyName: string;
    companyInn: string;
    userEmail: string;
    userName: string;
  },
) {
  await insertAdminNotifications(tx, {
    buyerCompanyId: values.buyerCompanyId,
    type: "company_join_request_created",
    title: "Новая заявка на присоединение",
    body: `${values.userName || values.userEmail} хочет присоединиться к ${values.companyName}, ИНН ${values.companyInn}.`,
  });
}

async function queueRegistrationEmail(
  tx: AuthTransaction,
  values: {
    email: string;
    name: string;
    companyName: string;
    pendingJoin: boolean;
  },
) {
  await tx.insert(emailOutbox).values({
    toEmail: values.email,
    subject: values.pendingJoin
      ? "Заявка на присоединение отправлена"
      : "Регистрация в Сити Маркет",
    body: values.pendingJoin
      ? [
          `Здравствуйте${values.name ? `, ${values.name}` : ""}.`,
          `Мы получили вашу заявку на присоединение к компании ${values.companyName}.`,
          "Администратор проверит заявку, после подтверждения вы сможете войти в личный кабинет.",
        ].join("\n")
      : [
          `Здравствуйте${values.name ? `, ${values.name}` : ""}.`,
          `Компания ${values.companyName} зарегистрирована в Сити Маркет.`,
          "Теперь вы можете оформлять заказы, получать счета и документы в личном кабинете.",
        ].join("\n"),
  });
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
  const inn = normalizeInn(getString(formData, "inn"));
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  const name = getString(formData, "name");
  const phone = getString(formData, "phone");
  const companyName = getString(formData, "companyName");
  const kpp = getString(formData, "kpp");
  const ogrn = getString(formData, "ogrn");
  const directorName = getString(formData, "directorName");
  const legalAddress = getString(formData, "legalAddress");
  const contactEmail = getString(formData, "contactEmail") || email;
  const contactPhone = getString(formData, "contactPhone") || phone;
  const bankDetails = {
    bankName: getString(formData, "bankName"),
    bik: getString(formData, "bik"),
    checkingAccount: getString(formData, "checkingAccount"),
    correspondentAccount: getString(formData, "correspondentAccount"),
  };

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

        await notifyAdminsAboutCompanyJoinRequest(tx, {
          buyerCompanyId: existingCompany.id,
          companyName: existingCompany.name,
          companyInn: existingCompany.inn,
          userEmail: email,
          userName: name,
        });

        await queueRegistrationEmail(tx, {
          email,
          name,
          companyName: existingCompany.name,
          pendingJoin: true,
        });
      });

      redirect("/login?pending=company&resubmitted=1");
    }

    await db.transaction(async (tx) => {
      const [pendingUser] = await tx
        .insert(users)
        .values({
          name,
          email,
          phone,
          passwordHash: hashPassword(password),
          role: "buyer",
          status: "pending_join",
        })
        .returning({ id: users.id });

      await tx.insert(companyJoinRequests).values({
        userId: pendingUser.id,
        buyerCompanyId: existingCompany.id,
      });

      await notifyAdminsAboutCompanyJoinRequest(tx, {
        buyerCompanyId: existingCompany.id,
        companyName: existingCompany.name,
        companyInn: existingCompany.inn,
        userEmail: email,
        userName: name,
      });

      await queueRegistrationEmail(tx, {
        email,
        name,
        companyName: existingCompany.name,
        pendingJoin: true,
      });
    });

    redirect("/login?pending=company");
  }

  const type = companyType === "ip" ? "ip" : "ooo";
  const missingCompanyFields = getCompanyMissingFields({
    type,
    name: companyName,
    inn,
    kpp,
    ogrn,
    directorName,
    legalAddress,
    bankDetails,
    contactEmail,
    contactPhone,
  });

  if (missingCompanyFields.length > 0) {
    redirect("/register?error=required");
  }

  if (existingUser && canReusePendingUser) {
    let createdCompanyId = "";

    await db.transaction(async (tx) => {
      const [company] = await tx
        .insert(buyerCompanies)
        .values({
          type,
          name: companyName,
          inn,
          kpp: type === "ooo" ? kpp : null,
          ogrn,
          directorName,
          legalAddress,
          bankDetails,
          contactEmail,
          contactPhone,
        })
        .returning({ id: buyerCompanies.id });

      createdCompanyId = company.id;

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

      await queueRegistrationEmail(tx, {
        email,
        name,
        companyName,
        pendingJoin: false,
      });
    });

    await generateBuyerCompanyContract(createdCompanyId, existingUser.id, {
      source: "registration",
    });
    await createSession(existingUser.id);
    await mergeGuestCartIntoUserCart(existingUser.id);
    redirect("/account");
  }

  const [company] = await db
    .insert(buyerCompanies)
    .values({
      type,
      name: companyName,
      inn,
      kpp: type === "ooo" ? kpp : null,
      ogrn,
      directorName,
      legalAddress,
      bankDetails,
      contactEmail,
      contactPhone,
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

  await db.transaction(async (tx) => {
    await queueRegistrationEmail(tx, {
      email,
      name,
      companyName,
      pendingJoin: false,
    });
  });

  await generateBuyerCompanyContract(company.id, user.id, {
    source: "registration",
  });
  await createSession(user.id);
  await mergeGuestCartIntoUserCart(user.id);
  redirect("/account");
}
