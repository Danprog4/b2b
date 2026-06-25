"use server";

import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditEvents,
  buyerCompanies,
  companyJoinRequests,
  documentVersions,
  documents,
  emailOutbox,
  files,
  users,
} from "@/db/schema";
import { createSession, destroyCurrentSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isPasswordPolicyValid } from "@/lib/auth/password-policy";
import { mergeGuestCartIntoUserCart } from "@/lib/cart/merge";
import { normalizeDigits, normalizeInn } from "@/lib/company-normalize";
import { getCompanyMissingFields } from "@/lib/account/company-validation";
import { generateBuyerCompanyContract } from "@/lib/contracts/generation";
import { writeStorageFile } from "@/lib/files/storage";
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

function withNext(path: string, nextPath: string | null) {
  if (!nextPath) {
    return path;
  }

  return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(
    nextPath,
  )}`;
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

const allowedRegistrationDocumentExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "xls",
  "xlsx",
]);
const inferredRegistrationDocumentMimeTypeByExtension = new Map([
  ["pdf", "application/pdf"],
  ["doc", "application/msword"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["xls", "application/vnd.ms-excel"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
]);
const registrationDocumentMimeTypesByExtension = new Map([
  ["pdf", new Set(["application/pdf"])],
  ["doc", new Set(["application/msword"])],
  [
    "docx",
    new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    ]),
  ],
  ["jpg", new Set(["image/jpeg"])],
  ["jpeg", new Set(["image/jpeg"])],
  ["png", new Set(["image/png"])],
  ["xls", new Set(["application/vnd.ms-excel"])],
  [
    "xlsx",
    new Set([
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
    ]),
  ],
]);
const maxRegistrationDocumentSizeBytes = 50 * 1024 * 1024;

type RegistrationDocumentUpload = {
  bytes: Uint8Array;
  file: File;
  mimeType: string;
  title: string;
  type: "company_card" | "charter";
};

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function normalizeFileName(fileName: string) {
  const normalized = fileName
    .replace(/[^\w.\-а-яА-ЯёЁ ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);

  return normalized || "document";
}

function bytesStartWith(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[index] === byte);
}

function hasExpectedRegistrationDocumentSignature(
  extension: string,
  bytes: Uint8Array,
) {
  if (extension === "pdf") {
    return bytesStartWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  }

  if (extension === "png") {
    return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  if (extension === "jpg" || extension === "jpeg") {
    return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  }

  if (extension === "doc" || extension === "xls") {
    return bytesStartWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }

  if (extension === "docx" || extension === "xlsx") {
    return bytesStartWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  }

  return false;
}

function redirectWithRegistrationDocumentError(
  nextPath: string | null,
  message: string,
): never {
  redirect(
    withNext(
      `/register?error=document&documentError=${encodeURIComponent(message)}`,
      nextPath,
    ),
  );
}

async function getOptionalRegistrationDocument(
  formData: FormData,
  key: string,
  type: RegistrationDocumentUpload["type"],
  title: string,
  nextPath: string | null,
): Promise<RegistrationDocumentUpload | null> {
  const value = formData.get(key);

  if (!(value instanceof File) || value.size === 0 || !value.name) {
    return null;
  }

  const extension = getFileExtension(value.name);

  if (!allowedRegistrationDocumentExtensions.has(extension)) {
    redirectWithRegistrationDocumentError(
      nextPath,
      "Поддерживаются только PDF, DOC, DOCX, JPG, PNG, XLS и XLSX.",
    );
  }

  if (value.size > maxRegistrationDocumentSizeBytes) {
    redirectWithRegistrationDocumentError(
      nextPath,
      "Файл документа должен быть не больше 50 МБ.",
    );
  }

  const mimeType = value.type || "";
  const expectedMimeTypes = registrationDocumentMimeTypesByExtension.get(extension);
  const isGenericMimeType =
    !mimeType || mimeType === "application/octet-stream";

  if (!isGenericMimeType && !expectedMimeTypes?.has(mimeType)) {
    redirectWithRegistrationDocumentError(
      nextPath,
      "Формат файла документа не поддерживается.",
    );
  }

  const bytes = new Uint8Array(await value.arrayBuffer());

  if (!hasExpectedRegistrationDocumentSignature(extension, bytes)) {
    redirectWithRegistrationDocumentError(
      nextPath,
      "Файл не соответствует выбранному формату. Проверьте расширение и загрузите документ повторно.",
    );
  }

  return {
    bytes,
    file: value,
    mimeType: isGenericMimeType
      ? (inferredRegistrationDocumentMimeTypeByExtension.get(extension) ??
        "application/octet-stream")
      : mimeType,
    title,
    type,
  };
}

async function getRegistrationDocuments(
  formData: FormData,
  nextPath: string | null,
) {
  const registrationDocuments = await Promise.all([
    getOptionalRegistrationDocument(
      formData,
      "companyCardFile",
      "company_card",
      "Карточка компании",
      nextPath,
    ),
    getOptionalRegistrationDocument(
      formData,
      "charterFile",
      "charter",
      "Уставные документы",
      nextPath,
    ),
  ]);

  return registrationDocuments.filter(
    (document): document is RegistrationDocumentUpload => Boolean(document),
  );
}

async function persistRegistrationDocument(
  tx: AuthTransaction,
  values: {
    buyerCompanyId: string;
    document: RegistrationDocumentUpload;
    userId: string;
  },
) {
  const fileName = normalizeFileName(values.document.file.name);
  const storageKey = `documents/buyer-companies/${values.buyerCompanyId}/${randomUUID()}-${fileName}`;
  const { sizeBytes } = await writeStorageFile(storageKey, values.document.bytes, {
    contentType: values.document.mimeType,
  });

  const [storedFile] = await tx
    .insert(files)
    .values({
      originalName: values.document.file.name,
      storageKey,
      mimeType: values.document.mimeType,
      sizeBytes,
      access: "private",
      uploadedById: values.userId,
    })
    .returning({ id: files.id });

  const [documentRow] = await tx
    .insert(documents)
    .values({
      type: values.document.type,
      title: values.document.title,
      target: "buyer_company",
      buyerCompanyId: values.buyerCompanyId,
      currentVersion: 1,
      isVisibleToBuyer: true,
      uploadedById: values.userId,
    })
    .returning({ id: documents.id });

  await tx.insert(documentVersions).values({
    documentId: documentRow.id,
    fileId: storedFile.id,
    version: 1,
    comment: "Загружено при регистрации",
    uploadedById: values.userId,
  });

  await tx.insert(auditEvents).values({
    actorId: values.userId,
    action: "document.upload",
    entityType: "document",
    entityId: documentRow.id,
    metadata: {
      source: "registration",
      target: "buyer_company",
      buyerCompanyId: values.buyerCompanyId,
      type: values.document.type,
      title: values.document.title,
    },
  });
}

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
    redirect(withNext("/login?error=invalid", nextPath));
  }

  if (user.status !== "active") {
    if (user.role === "buyer" && user.status === "pending_join") {
      const pendingRequest = await getPendingCompanyJoinRequest(user.id);

      if (pendingRequest) {
        redirect(withNext("/login?pending=company", nextPath));
      }

      const latestRequest = await getLatestCompanyJoinRequest(user.id);

      if (latestRequest?.status === "rejected") {
        redirect(withNext("/register?retry=company", nextPath));
      }
    }

    redirect(withNext("/login?error=inactive", nextPath));
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
  const nextPath = getSafeNextPath(getString(formData, "next"));
  const name = getString(formData, "name");
  const phone = getString(formData, "phone");
  const companyName = getString(formData, "companyName");
  const kpp = normalizeDigits(getString(formData, "kpp"));
  const ogrn = normalizeDigits(getString(formData, "ogrn"));
  const directorName = getString(formData, "directorName");
  const legalAddress = getString(formData, "legalAddress");
  const contactEmail = getString(formData, "contactEmail") || email;
  const contactPhone = getString(formData, "contactPhone") || phone;
  const bankDetails = {
    bankName: getString(formData, "bankName"),
    bik: normalizeDigits(getString(formData, "bik")),
    checkingAccount: normalizeDigits(getString(formData, "checkingAccount")),
    correspondentAccount: normalizeDigits(
      getString(formData, "correspondentAccount"),
    ),
  };

  if (!email || !password || !inn || !companyName || !phone) {
    redirect(withNext("/register?error=required", nextPath));
  }

  if (!isPasswordPolicyValid(password)) {
    redirect(withNext("/register?error=password", nextPath));
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
      redirect(withNext("/register?error=email", nextPath));
    }

    const pendingRequest = await getPendingCompanyJoinRequest(existingUser.id);

    if (pendingRequest) {
      redirect(withNext("/login?pending=company", nextPath));
    }

    const latestRequest = await getLatestCompanyJoinRequest(existingUser.id);

    if (latestRequest?.status !== "rejected") {
      redirect(withNext("/register?error=email", nextPath));
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

      redirect(withNext("/login?pending=company&resubmitted=1", nextPath));
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

    redirect(withNext("/login?pending=company", nextPath));
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
    redirect(withNext("/register?error=company_details", nextPath));
  }

  const registrationDocuments =
    formData.get("skipDocuments") === "1"
      ? []
      : await getRegistrationDocuments(formData, nextPath);

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

      for (const document of registrationDocuments) {
        await persistRegistrationDocument(tx, {
          buyerCompanyId: company.id,
          document,
          userId: existingUser.id,
        });
      }
    });

    await generateBuyerCompanyContract(createdCompanyId, existingUser.id, {
      source: "registration",
    });
    await createSession(existingUser.id);
    await mergeGuestCartIntoUserCart(existingUser.id);
    redirect(nextPath ?? "/account");
  }

  let createdCompanyId = "";
  let createdUserId = "";

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

    const [user] = await tx
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
      .returning({ id: users.id });

    createdCompanyId = company.id;
    createdUserId = user.id;

    await queueRegistrationEmail(tx, {
      email,
      name,
      companyName,
      pendingJoin: false,
    });

    for (const document of registrationDocuments) {
      await persistRegistrationDocument(tx, {
        buyerCompanyId: company.id,
        document,
        userId: user.id,
      });
    }
  });

  await generateBuyerCompanyContract(createdCompanyId, createdUserId, {
    source: "registration",
  });
  await createSession(createdUserId);
  await mergeGuestCartIntoUserCart(createdUserId);
  redirect(nextPath ?? "/account");
}
