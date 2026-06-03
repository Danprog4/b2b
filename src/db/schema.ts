import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["buyer", "seller", "admin"]);
export const userStatusEnum = pgEnum("user_status", [
  "active",
  "blocked",
  "pending_join",
]);
export const companyTypeEnum = pgEnum("company_type", ["ooo", "ip"]);
export const sellerStatusEnum = pgEnum("seller_status", [
  "active",
  "inactive",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "awaiting_payment",
  "paid",
  "issued",
  "closed",
  "cancelled",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "generated",
  "failed",
]);
export const fileAccessEnum = pgEnum("file_access", ["public", "private"]);
export const documentTargetEnum = pgEnum("document_target", [
  "buyer_company",
  "order",
  "seller",
  "chat",
  "contract",
]);
export const messageSenderTypeEnum = pgEnum("message_sender_type", [
  "buyer",
  "operator",
  "admin",
]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "sent",
  "failed",
]);
export const emailOutboxStatusEnum = pgEnum("email_outbox_status", [
  "queued",
  "sent",
  "failed",
]);
export const importJobStatusEnum = pgEnum("import_job_status", [
  "uploaded",
  "validated",
  "failed",
  "imported",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const buyerCompanies = pgTable(
  "buyer_companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: companyTypeEnum("type").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    inn: varchar("inn", { length: 12 }).notNull(),
    kpp: varchar("kpp", { length: 9 }),
    ogrn: varchar("ogrn", { length: 15 }),
    legalAddress: text("legal_address"),
    bankDetails: jsonb("bank_details").$type<Record<string, string>>(),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("buyer_companies_inn_idx").on(table.inn)],
);

export const sellers = pgTable(
  "sellers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    inn: varchar("inn", { length: 12 }).notNull(),
    kpp: varchar("kpp", { length: 9 }),
    ogrn: varchar("ogrn", { length: 15 }),
    legalAddress: text("legal_address"),
    bankDetails: jsonb("bank_details").$type<Record<string, string>>(),
    contactName: varchar("contact_name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 })
      .default("5.00")
      .notNull(),
    status: sellerStatusEnum("status").default("active").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("sellers_inn_idx").on(table.inn)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull(),
    status: userStatusEnum("status").default("active").notNull(),
    buyerCompanyId: uuid("buyer_company_id").references(() => buyerCompanies.id),
    sellerId: uuid("seller_id").references(() => sellers.id),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_buyer_company_idx").on(table.buyerCompanyId),
    index("users_seller_idx").on(table.sellerId),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_idx").on(table.tokenHash),
    index("auth_sessions_user_idx").on(table.userId),
  ],
);

export const companyJoinRequests = pgTable(
  "company_join_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    buyerCompanyId: uuid("buyer_company_id")
      .references(() => buyerCompanies.id)
      .notNull(),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    reviewedById: uuid("reviewed_by_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("company_join_requests_user_idx").on(table.userId),
    index("company_join_requests_company_idx").on(table.buyerCompanyId),
  ],
);

export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  access: fileAccessEnum("access").default("private").notNull(),
  uploadedById: uuid("uploaded_by_id").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    imageFileId: uuid("image_file_id").references(() => files.id),
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("categories_slug_idx").on(table.slug)],
);

export const subcategories = pgTable(
  "subcategories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .references(() => categories.id)
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    imageFileId: uuid("image_file_id").references(() => files.id),
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("subcategories_slug_idx").on(table.slug),
    index("subcategories_category_idx").on(table.categoryId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: varchar("sku", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    categoryId: uuid("category_id")
      .references(() => categories.id)
      .notNull(),
    subcategoryId: uuid("subcategory_id").references(() => subcategories.id),
    sellerId: uuid("seller_id").references(() => sellers.id),
    mainImageFileId: uuid("main_image_file_id").references(() => files.id),
    description: text("description"),
    priceWithVat: numeric("price_with_vat", {
      precision: 12,
      scale: 2,
    }).notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("22.00"),
    size: varchar("size", { length: 128 }),
    unit: varchar("unit", { length: 32 }).notNull(),
    isPopular: boolean("is_popular").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_sku_idx").on(table.sku),
    uniqueIndex("products_slug_idx").on(table.slug),
    index("products_category_idx").on(table.categoryId),
    index("products_subcategory_idx").on(table.subcategoryId),
    index("products_seller_idx").on(table.sellerId),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    fileId: uuid("file_id")
      .references(() => files.id)
      .notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [index("product_images_product_idx").on(table.productId)],
);

export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  sessionId: varchar("session_id", { length: 128 }),
  ...timestamps,
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .references(() => carts.id)
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    priceSnapshot: numeric("price_snapshot", { precision: 12, scale: 2 }).notNull(),
    ...timestamps,
  },
  (table) => [index("cart_items_cart_idx").on(table.cartId)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: varchar("number", { length: 32 }).notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    buyerCompanyId: uuid("buyer_company_id")
      .references(() => buyerCompanies.id)
      .notNull(),
    status: orderStatusEnum("status").default("new").notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull(),
    comment: text("comment"),
    technicalState: jsonb("technical_state")
      .$type<Record<string, boolean | string | null>>()
      .default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_number_idx").on(table.number),
    index("orders_company_idx").on(table.buyerCompanyId),
    index("orders_status_idx").on(table.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    productId: uuid("product_id").references(() => products.id),
    sellerId: uuid("seller_id").references(() => sellers.id),
    productNameSnapshot: varchar("product_name_snapshot", { length: 255 }).notNull(),
    skuSnapshot: varchar("sku_snapshot", { length: 32 }).notNull(),
    unitSnapshot: varchar("unit_snapshot", { length: 32 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    priceWithVat: numeric("price_with_vat", { precision: 12, scale: 2 }).notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull(),
    vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
    commissionAmount: numeric("commission_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    index("order_items_seller_idx").on(table.sellerId),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: varchar("number", { length: 32 }).notNull(),
    orderId: uuid("order_id")
      .references(() => orders.id)
      .notNull(),
    fileId: uuid("file_id").references(() => files.id),
    status: invoiceStatusEnum("status").default("pending").notNull(),
    errorMessage: text("error_message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    emailErrorMessage: text("email_error_message"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invoices_number_idx").on(table.number),
    uniqueIndex("invoices_order_idx").on(table.orderId),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    target: documentTargetEnum("target").notNull(),
    buyerCompanyId: uuid("buyer_company_id").references(() => buyerCompanies.id),
    orderId: uuid("order_id").references(() => orders.id),
    sellerId: uuid("seller_id").references(() => sellers.id),
    chatId: uuid("chat_id"),
    currentVersion: integer("current_version").default(1).notNull(),
    isVisibleToBuyer: boolean("is_visible_to_buyer").default(false).notNull(),
    isVisibleToSeller: boolean("is_visible_to_seller").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    uploadedById: uuid("uploaded_by_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index("documents_company_idx").on(table.buyerCompanyId),
    index("documents_order_idx").on(table.orderId),
    index("documents_seller_idx").on(table.sellerId),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .references(() => documents.id)
      .notNull(),
    fileId: uuid("file_id")
      .references(() => files.id)
      .notNull(),
    version: integer("version").notNull(),
    comment: text("comment"),
    uploadedById: uuid("uploaded_by_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("document_versions_document_idx").on(table.documentId)],
);

export const chats = pgTable("chats", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  buyerCompanyId: uuid("buyer_company_id")
    .references(() => buyerCompanies.id)
    .notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  status: varchar("status", { length: 32 }).default("open").notNull(),
  telegramThreadKey: varchar("telegram_thread_key", { length: 255 }),
  ...timestamps,
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatId: uuid("chat_id")
      .references(() => chats.id)
      .notNull(),
    senderId: uuid("sender_id").references(() => users.id),
    senderType: messageSenderTypeEnum("sender_type").notNull(),
    text: text("text"),
    attachmentFileId: uuid("attachment_file_id").references(() => files.id),
    deliveryStatus: deliveryStatusEnum("delivery_status")
      .default("pending")
      .notNull(),
    telegramMessageId: varchar("telegram_message_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("messages_chat_idx").on(table.chatId)],
);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  buyerCompanyId: uuid("buyer_company_id").references(() => buyerCompanies.id),
  sellerId: uuid("seller_id").references(() => sellers.id),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toEmail: varchar("to_email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    status: emailOutboxStatusEnum("status").default("queued").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    attachmentFileId: uuid("attachment_file_id").references(() => files.id),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("email_outbox_status_idx").on(table.status),
    index("email_outbox_order_idx").on(table.orderId),
  ],
);

export const banners = pgTable("banners", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  desktopImageFileId: uuid("desktop_image_file_id").references(() => files.id),
  mobileImageFileId: uuid("mobile_image_file_id").references(() => files.id),
  headline: varchar("headline", { length: 255 }),
  subheadline: text("subheadline"),
  ctaText: varchar("cta_text", { length: 64 }),
  href: text("href"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  ...timestamps,
});

export const contentPages = pgTable(
  "content_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    content: text("content"),
    metaTitle: varchar("meta_title", { length: 255 }),
    metaDescription: text("meta_description"),
    isPublished: boolean("is_published").default(false).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("content_pages_slug_idx").on(table.slug)],
);

export const systemEvents = pgTable("system_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  severity: varchar("severity", { length: 16 }).default("info").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileId: uuid("file_id").references(() => files.id),
  status: importJobStatusEnum("status").default("uploaded").notNull(),
  totalRows: integer("total_rows").default(0).notNull(),
  createdRows: integer("created_rows").default(0).notNull(),
  updatedRows: integer("updated_rows").default(0).notNull(),
  errorRows: integer("error_rows").default(0).notNull(),
  createdById: uuid("created_by_id").references(() => users.id),
  ...timestamps,
});

export const importJobRows = pgTable(
  "import_job_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importJobId: uuid("import_job_id")
      .references(() => importJobs.id)
      .notNull(),
    rowNumber: integer("row_number").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    errors: jsonb("errors").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("import_job_rows_job_idx").on(table.importJobId)],
);
