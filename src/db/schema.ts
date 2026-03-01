import {
    mysqlTable,
    varchar,
    text,
    int,
    boolean,
    datetime,
    timestamp,
    decimal,
    mysqlEnum
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ========== better-auth core tables ==========

export const user = mysqlTable("user", {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: varchar("image", { length: 255 }),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
});

export const session = mysqlTable("session", {
    id: varchar("id", { length: 36 }).primaryKey(),
    expiresAt: datetime("expires_at").notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
    ipAddress: varchar("ip_address", { length: 255 }),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 36 })
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
});

export const account = mysqlTable("account", {
    id: varchar("id", { length: 36 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 36 })
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: datetime("access_token_expires_at"),
    refreshTokenExpiresAt: datetime("refresh_token_expires_at"),
    scope: varchar("scope", { length: 255 }),
    password: varchar("password", { length: 255 }),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
});

export const verification = mysqlTable("verification", {
    id: varchar("id", { length: 36 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: varchar("value", { length: 255 }).notNull(),
    expiresAt: datetime("expires_at").notNull(),
    createdAt: datetime("created_at"),
    updatedAt: datetime("updated_at"),
});

// ========== Application tables ==========

export const siteSettings = mysqlTable("site_settings", {
    id: varchar("id", { length: 36 }).primaryKey(),
    key: varchar("key", { length: 255 }).notNull().unique(),
    value: text("value").notNull().default(""),
    type: varchar("type", { length: 50 }).notNull().default("text"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const heroSlides = mysqlTable("hero_slides", {
    id: varchar("id", { length: 36 }).primaryKey(),
    title: varchar("title", { length: 255 }).notNull().default(""),
    subtitle: varchar("subtitle", { length: 500 }).notNull().default(""),
    ctaText: varchar("cta_text", { length: 255 }).notNull().default(""),
    ctaLink: varchar("cta_link", { length: 500 }).notNull().default(""),
    imageUrl: varchar("image_url", { length: 500 }).notNull().default(""),
    bgColor: varchar("bg_color", { length: 255 }).notNull().default("from-red-600 via-red-500 to-red-700"),
    sortOrder: int("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: datetime("created_at").notNull(),
});

export const programs = mysqlTable("programs", {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    thumbnail: varchar("thumbnail", { length: 500 }).notNull().default(""),
    category: varchar("category", { length: 50 }).notNull().default("pelanggan"),
    period: varchar("period", { length: 255 }).notNull().default(""),
    content: text("content").notNull().default(""),
    terms: text("terms").notNull().default("[]"),
    mechanics: text("mechanics").notNull().default("[]"),
    gallery: text("gallery").notNull().default("[]"),
    prizes: text("prizes").notNull().default("[]"),
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const dynamicForms = mysqlTable("dynamic_forms", {
    id: varchar("id", { length: 36 }).primaryKey(),
    programId: varchar("program_id", { length: 36 }).notNull().references(() => programs.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    formSchema: text("form_schema").notNull().default("[]"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: datetime("created_at").notNull(),
});

export const formFields = mysqlTable("form_fields", {
    id: varchar("id", { length: 36 }).primaryKey(),
    formId: varchar("form_id", { length: 36 }).notNull().references(() => dynamicForms.id, { onDelete: "cascade" }),
    fieldType: varchar("field_type", { length: 50 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    placeholder: varchar("placeholder", { length: 255 }).notNull().default(""),
    hintText: varchar("hint_text", { length: 500 }).notNull().default(""),
    isRequired: boolean("is_required").notNull().default(false),
    options: text("options").notNull().default("[]"),
    sortOrder: int("sort_order").notNull().default(0),
});

export const formSubmissions = mysqlTable("form_submissions", {
    id: varchar("id", { length: 36 }).primaryKey(),
    formId: varchar("form_id", { length: 36 }).notNull().references(() => dynamicForms.id, { onDelete: "cascade" }),
    period: varchar("period", { length: 100 }).notNull().default(""),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    participantName: varchar("participant_name", { length: 255 }).notNull().default("Peserta"),
    participantPhone: varchar("participant_phone", { length: 255 }).notNull().default("-"),
    submittedAt: datetime("submitted_at").notNull(),
});

export const submissionValues = mysqlTable("submission_values", {
    id: varchar("id", { length: 36 }).primaryKey(),
    submissionId: varchar("submission_id", { length: 36 }).notNull().references(() => formSubmissions.id, { onDelete: "cascade" }),
    fieldId: varchar("field_id", { length: 36 }).notNull().references(() => formFields.id, { onDelete: "cascade" }),
    value: text("value").notNull().default(""),
    filePath: varchar("file_path", { length: 500 }).notNull().default(""),
});

export const winners = mysqlTable("winners", {
    id: varchar("id", { length: 36 }).primaryKey(),
    programId: varchar("program_id", { length: 36 }).notNull().references(() => programs.id, { onDelete: "cascade" }),
    submissionId: varchar("submission_id", { length: 36 }).notNull().unique().references(() => formSubmissions.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull().default(""),
    outlet: varchar("outlet", { length: 255 }).notNull().default(""),
    period: varchar("period", { length: 100 }).notNull().default(""),
    photoUrl: varchar("photo_url", { length: 500 }).notNull().default(""),
    prizeName: varchar("prize_name", { length: 255 }).notNull().default("Hadiah Utama"),
    drawnAt: datetime("drawn_at").notNull(),
});

// ========== E-Commerce / Shopping ========

export const products = mysqlTable("products", {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    type: mysqlEnum("type", ["fisik", "virtual", "jasa"]).notNull().default("fisik"),
    description: text("description").notNull().default(""),
    imageUrl: varchar("image_url", { length: 500 }).notNull().default(""),
    price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
    stock: int("stock").notNull().default(0), // Applicable primarily for physical
    isActive: boolean("is_active").notNull().default(true),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const orders = mysqlTable("orders", {
    id: varchar("id", { length: 36 }).primaryKey(),
    customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
    productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id),
    paymentStatus: mysqlEnum("payment_status", ["pending", "success", "failed"]).notNull().default("pending"),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
    lynkIdUrl: text("lynk_id_url"), // The generated payment link
    lynkIdTrx: varchar("lynk_id_trx", { length: 255 }), // Webhook reference
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const vouchers = mysqlTable("vouchers", {
    id: varchar("id", { length: 36 }).primaryKey(),
    productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 255 }).notNull().unique(),
    isUsed: boolean("is_used").notNull().default(false),
    createdAt: datetime("created_at").notNull(),
    usedAt: datetime("used_at"),
});

export const redemptionLogs = mysqlTable("redemption_logs", {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    voucherId: varchar("voucher_id", { length: 36 }).notNull().references(() => vouchers.id),
    status: mysqlEnum("status", ["sukses", "gagal"]).notNull(),
    responseMessage: text("response_message").notNull().default(""),
    createdAt: datetime("created_at").notNull(),
});

// ========== Relations ==========

export const programsRelations = relations(programs, ({ many }) => ({
    forms: many(dynamicForms),
    winners: many(winners),
}));

export const dynamicFormsRelations = relations(dynamicForms, ({ one, many }) => ({
    program: one(programs, { fields: [dynamicForms.programId], references: [programs.id] }),
    fields: many(formFields),
    submissions: many(formSubmissions),
}));

export const formFieldsRelations = relations(formFields, ({ one, many }) => ({
    form: one(dynamicForms, { fields: [formFields.formId], references: [dynamicForms.id] }),
    submissionValues: many(submissionValues),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one, many }) => ({
    form: one(dynamicForms, { fields: [formSubmissions.formId], references: [dynamicForms.id] }),
    submissionValues: many(submissionValues),
    winner: one(winners),
}));

export const submissionValuesRelations = relations(submissionValues, ({ one }) => ({
    submission: one(formSubmissions, { fields: [submissionValues.submissionId], references: [formSubmissions.id] }),
    field: one(formFields, { fields: [submissionValues.fieldId], references: [formFields.id] }),
}));

export const winnersRelations = relations(winners, ({ one }) => ({
    program: one(programs, { fields: [winners.programId], references: [programs.id] }),
    submission: one(formSubmissions, { fields: [winners.submissionId], references: [formSubmissions.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
    orders: many(orders),
    vouchers: many(vouchers),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
    product: one(products, { fields: [orders.productId], references: [products.id] }),
    redemptionLogs: many(redemptionLogs),
}));

export const vouchersRelations = relations(vouchers, ({ one, many }) => ({
    product: one(products, { fields: [vouchers.productId], references: [products.id] }),
    redemptionLogs: many(redemptionLogs),
}));

export const redemptionLogsRelations = relations(redemptionLogs, ({ one }) => ({
    order: one(orders, { fields: [redemptionLogs.orderId], references: [orders.id] }),
    voucher: one(vouchers, { fields: [redemptionLogs.voucherId], references: [vouchers.id] }),
}));
