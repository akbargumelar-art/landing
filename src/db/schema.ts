import {
    mysqlTable,
    varchar,
    text,
    int,
    boolean,
    datetime,
    timestamp,
    decimal,
    double,
    foreignKey,
    index,
    json,
    mysqlEnum,
    primaryKey,
    uniqueIndex
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import {
    DEFAULT_OUTLET_BRANDING,
    DEFAULT_OUTLET_CATEGORY,
    DEFAULT_PJP_DAY,
    DEFAULT_PJP_TYPE,
    OUTLET_BRANDINGS,
    OUTLET_CATEGORIES,
    PJP_DAYS,
    PJP_TYPES,
} from "@/lib/mitra-outlet-options";

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

export type ProgramMode = "UNDIAN" | "PERFORMANCE";

// Unified program table (prd-total-revamp.md 2.4). `mode` distinguishes the two engines
// that used to live in separate tables:
//   UNDIAN      - entrants register through dynamic_forms, winner drawn from submissions
//   PERFORMANCE - outlets score via imports, ranked on program_leaderboard
// The PERFORMANCE-only columns below are nullable so pre-existing UNDIAN rows are unaffected.
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

    // Template WhatsApp khusus program ini. Koneksi gateway-nya tetap yang umum di
    // Pengaturan; hanya isi pesannya yang per program, karena placeholder tiap fitur berbeda.
    waTemplate: text("wa_template"),
    waNotifyEnabled: boolean("wa_notify_enabled").notNull().default(true),

    mode: mysqlEnum("mode", ["UNDIAN", "PERFORMANCE"]).notNull().default("UNDIAN"),
    // PERFORMANCE-only fields, carried over from the old mitra_programs table.
    mechanismMd: text("mechanism_md"),
    periodStart: datetime("period_start"),
    periodEnd: datetime("period_end"),
    rankingMode: mysqlEnum("ranking_mode", ["POINT", "RANK"]),
    tieBreaker: varchar("tie_breaker", { length: 120 }),
    isPublic: boolean("is_public").notNull().default(false),
}, (table) => [
    index("programs_mode_idx").on(table.mode),
    index("programs_public_idx").on(table.isPublic),
]);

// Unified winners table. Exactly one of submissionId (UNDIAN) or outletId (PERFORMANCE)
// is populated, matching the parent program's mode.
export const programWinners = mysqlTable("program_winners", {
    id: varchar("id", { length: 36 }).primaryKey(),
    programId: varchar("program_id", { length: 36 }).notNull().references(() => programs.id, { onDelete: "cascade" }),
    mode: mysqlEnum("mode", ["UNDIAN", "PERFORMANCE"]).notNull(),

    // UNDIAN branch
    submissionId: varchar("submission_id", { length: 36 }),
    name: varchar("name", { length: 255 }).notNull().default(""),
    phone: varchar("phone", { length: 50 }).notNull().default(""),
    outlet: varchar("outlet", { length: 255 }).notNull().default(""),
    period: varchar("period", { length: 100 }).notNull().default(""),
    photoUrl: varchar("photo_url", { length: 500 }).notNull().default(""),
    prizeName: varchar("prize_name", { length: 255 }).notNull().default(""),
    drawnAt: datetime("drawn_at"),

    // PERFORMANCE branch
    outletId: varchar("outlet_id", { length: 36 }),
    rank: int("rank"),
    isPublished: boolean("is_published").notNull().default(false),
}, (table) => [
    index("program_winners_program_idx").on(table.programId),
    index("program_winners_mode_idx").on(table.mode),
    index("program_winners_public_idx").on(table.isPublished),
    uniqueIndex("program_winners_submission_idx").on(table.submissionId),
]);

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
}, (table) => [
    // GET /api/admin/submissions filters on these two and orders by submittedAt; without
    // indexes MySQL still full-scans even though the filters were pushed down to SQL.
    index("form_submissions_form_idx").on(table.formId),
    index("form_submissions_status_idx").on(table.status),
    index("form_submissions_submitted_idx").on(table.submittedAt),
]);

export const indihomeProducts = mysqlTable("indihome_products", {
    id: varchar("id", { length: 80 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    speedMbps: int("speed_mbps").notNull(),
    monthlyPrice: decimal("monthly_price", { precision: 12, scale: 2 }).notNull(),
    description: text("description").notNull(),
    features: json("features").$type<string[]>().notNull(),
    locations: json("locations").$type<string[]>().notNull(),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    index("indihome_products_active_idx").on(table.isActive),
    index("indihome_products_sort_idx").on(table.sortOrder),
]);

export const indihomeLeads = mysqlTable("indihome_leads", {
    id: varchar("id", { length: 36 }).primaryKey(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    phoneE164: varchar("phone_e164", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }),
    location: varchar("location", { length: 120 }).notNull(),
    district: varchar("district", { length: 120 }).notNull(),
    address: text("address").notNull(),
    packageId: varchar("package_id", { length: 80 }).notNull(),
    packageName: varchar("package_name", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["NEW", "CONTACTED", "SURVEY", "SUBMITTED", "CLOSED", "CANCELLED"]).notNull().default("NEW"),
    consent: boolean("consent").notNull(),
    source: varchar("source", { length: 80 }).notNull().default("landing_indihome"),
    ip: varchar("ip", { length: 120 }),
    userAgent: text("user_agent"),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    index("indihome_leads_phone_idx").on(table.phoneE164),
    index("indihome_leads_location_idx").on(table.location),
    index("indihome_leads_status_idx").on(table.status),
    index("indihome_leads_created_idx").on(table.createdAt),
]);

// Replaces the INDIHOME_LOCATIONS constant so new coverage areas no longer need a code
// deploy (prd-total-revamp.md 2.7). The constant stays in the codebase as a seed source
// and as a fallback when the database is unreachable.
export const indihomeLocations = mysqlTable("indihome_locations", {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: datetime("created_at").notNull(),
}, (table) => [
    index("indihome_locations_active_idx").on(table.isActive),
    index("indihome_locations_sort_idx").on(table.sortOrder),
]);

// Modelled on hero_slides so the IndiHome hero can grow into a multi-banner slider later.
// Today the public page renders the active banner with the lowest sort order.
export const indihomeBanners = mysqlTable("indihome_banners", {
    id: varchar("id", { length: 36 }).primaryKey(),
    imageUrl: varchar("image_url", { length: 500 }).notNull().default(""),
    headline: varchar("headline", { length: 255 }).notNull().default(""),
    subheadline: varchar("subheadline", { length: 500 }).notNull().default(""),
    ctaText: varchar("cta_text", { length: 255 }).notNull().default(""),
    ctaLink: varchar("cta_link", { length: 500 }).notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: datetime("created_at").notNull(),
}, (table) => [
    index("indihome_banners_active_idx").on(table.isActive),
    index("indihome_banners_sort_idx").on(table.sortOrder),
]);

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
    shopeeUrl: varchar("shopee_url", { length: 500 }).notNull().default(""),
    tokopediaUrl: varchar("tokopedia_url", { length: 500 }).notNull().default(""),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const orders = mysqlTable("orders", {
    id: varchar("id", { length: 36 }).primaryKey(),
    customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
    productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id),
    paymentGateway: mysqlEnum("payment_gateway", ["mayar", "midtrans"]).notNull().default("mayar"),
    paymentStatus: mysqlEnum("payment_status", ["pending", "success", "failed"]).notNull().default("pending"),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
    paymentUrl: text("payment_url"), // The generated payment gateway checkout link
    invoiceNumber: varchar("invoice_number", { length: 255 }), // Payment gateway invoice/transaction ID
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
    // Boleh null: kegagalan "stok voucher habis" terjadi justru ketika tidak ada voucher
    // yang bisa dirujuk. Sebelumnya kolom ini NOT NULL dan kode mengisinya dengan string
    // "NO-STOCK", yang melanggar foreign key di bawah sehingga kegagalan itu tidak pernah
    // tercatat sama sekali.
    voucherId: varchar("voucher_id", { length: 36 }).references(() => vouchers.id),
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

// ========== Kalkulator Cuan ==========

export const cuanCategories = mysqlTable("cuan_categories", {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: datetime("created_at").notNull(),
});

export const cuanBrands = mysqlTable("cuan_brands", {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: datetime("created_at").notNull(),
});

export const cuanProducts = mysqlTable("cuan_products", {
    id: varchar("id", { length: 36 }).primaryKey(),
    categoryId: varchar("category_id", { length: 36 }).notNull().references(() => cuanCategories.id, { onDelete: "cascade" }),
    brandId: varchar("brand_id", { length: 36 }).notNull().references(() => cuanBrands.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    capitalPrice: decimal("capital_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
    sellingPrice: decimal("selling_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
    cashback: decimal("cashback", { precision: 12, scale: 2 }).notNull().default("0.00"),
    isActive: boolean("is_active").notNull().default(true),
    isHot: boolean("is_hot").notNull().default(false),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const cuanCategoriesRelations = relations(cuanCategories, ({ many }) => ({
    products: many(cuanProducts),
}));

export const cuanBrandsRelations = relations(cuanBrands, ({ many }) => ({
    products: many(cuanProducts),
}));

export const cuanProductsRelations = relations(cuanProducts, ({ one }) => ({
    category: one(cuanCategories, { fields: [cuanProducts.categoryId], references: [cuanCategories.id] }),
    brand: one(cuanBrands, { fields: [cuanProducts.brandId], references: [cuanBrands.id] }),
}));

// ========== Portal Mitra Outlet ==========

export type MitraRole = "MANAGER" | "ADMIN" | "LEADER";
export type MitraDetailGroup = Record<string, number>;

export const mitraUserProfiles = mysqlTable("mitra_user_profiles", {
    userId: varchar("user_id", { length: 36 }).primaryKey().references(() => user.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 50 }),
    role: mysqlEnum("role", ["MANAGER", "ADMIN", "LEADER"]).notNull().default("MANAGER"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: datetime("last_login_at"),
    failedLoginAttempts: int("failed_login_attempts").notNull().default(0),
    lastFailedLoginAt: datetime("last_failed_login_at"),
    lockedUntil: datetime("locked_until"),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    index("mitra_user_profiles_role_idx").on(table.role),
]);

export const mitraTerritories = mysqlTable("mitra_territories", {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    type: mysqlEnum("type", ["REGION", "CLUSTER", "AREA"]).notNull(),
    parentId: varchar("parent_id", { length: 36 }),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    index("mitra_territories_parent_idx").on(table.parentId),
    index("mitra_territories_type_idx").on(table.type),
]);

export const mitraUserTerritories = mysqlTable("mitra_user_territories", {
    userId: varchar("user_id", { length: 36 }).notNull().references(() => user.id, { onDelete: "cascade" }),
    territoryId: varchar("territory_id", { length: 36 }).notNull().references(() => mitraTerritories.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.userId, table.territoryId], name: "mitra_user_territories_pk" }),
    index("mitra_user_territories_territory_idx").on(table.territoryId),
]);

/**
 * Master salesforce: satu baris per petugas, dipakai bersama oleh semua outlet yang
 * dikunjunginya. Sebelumnya nama dan fotonya disimpan berulang di tiap baris outlet,
 * sehingga ganti nama atau ganti foto berarti menyunting puluhan outlet satu per satu.
 *
 * Nama dijadikan unique karena itulah kunci pencocokan dari file import (kolom
 * `salesforce` di CSV hanya berisi nama, tanpa id).
 */
export const mitraSalesforces = mysqlTable("mitra_salesforces", {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    photoUrl: varchar("photo_url", { length: 500 }),
    phone: varchar("phone", { length: 50 }),
    tap: varchar("tap", { length: 255 }).notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    index("mitra_salesforces_active_idx").on(table.isActive),
]);

export const mitraOutlets = mysqlTable("mitra_outlets", {
    id: varchar("id", { length: 36 }).primaryKey(),
    outletCode: varchar("outlet_code", { length: 100 }).notNull().unique(),
    publicToken: varchar("public_token", { length: 80 }).notNull().unique(),
    rsNumber: varchar("rs_number", { length: 100 }).notNull().default(""),
    name: varchar("name", { length: 255 }).notNull(),
    ownerName: varchar("owner_name", { length: 255 }).notNull(),
    ownerPhone: varchar("owner_phone", { length: 50 }).notNull(),
    tap: varchar("tap", { length: 255 }).notNull().default(""),
    // Nama dan foto salesforce hidup di mitra_salesforces, bukan di sini. Import CSV
    // yang hanya membawa nama diselesaikan lewat resolveSalesforceId() di lib/mitra-salesforce.
    salesforceId: varchar("salesforce_id", { length: 36 }).references(() => mitraSalesforces.id, { onDelete: "set null" }),
    kabupaten: varchar("kabupaten", { length: 255 }).notNull().default(""),
    kecamatan: varchar("kecamatan", { length: 255 }).notNull().default(""),
    longitude: double("longitude"),
    latitude: double("latitude"),
    // Diturunkan dari latitude/longitude (lihat resolveOutletMapsUrl). Kolom tetap ada
    // supaya tautan manual pada data lama tidak hilang saat koordinat belum diisi.
    locationUrl: varchar("location_url", { length: 500 }),
    territoryId: varchar("territory_id", { length: 36 }).references(() => mitraTerritories.id, { onDelete: "set null" }),
    category: mysqlEnum("category", OUTLET_CATEGORIES).notNull().default(DEFAULT_OUTLET_CATEGORY),
    pjpDay: mysqlEnum("pjp_day", PJP_DAYS).notNull().default(DEFAULT_PJP_DAY),
    pjpType: mysqlEnum("pjp_type", PJP_TYPES).notNull().default(DEFAULT_PJP_TYPE),
    branding: mysqlEnum("branding", OUTLET_BRANDINGS).notNull().default(DEFAULT_OUTLET_BRANDING),
    status: mysqlEnum("status", ["ACTIVE", "INACTIVE", "SUSPENDED"]).notNull().default("ACTIVE"),
    /**
     * Empat slot foto outlet. photoUrl adalah foto tampak depan sekaligus foto utama
     * yang dipakai kartu direktori, hero profil, dan popup peta -- karena itu namanya
     * dipertahankan, supaya seluruh pembaca lama tetap bekerja tanpa join.
     *
     * Kolom *_updated_at bukan sekadar hiasan: kunjungan salesforce divalidasi lewat
     * kebaruan foto, jadi tanggalnya adalah datanya. Diisi eksplisit saat foto diunggah,
     * bukan lewat onUpdateNow, supaya perubahan kolom lain tidak ikut menyegarkannya.
     */
    photoUrl: varchar("photo_url", { length: 500 }),
    photoUpdatedAt: datetime("photo_updated_at"),
    photoEtalaseUrl: varchar("photo_etalase_url", { length: 500 }),
    photoEtalaseUpdatedAt: datetime("photo_etalase_updated_at"),
    photoPopTelkomselUrl: varchar("photo_pop_telkomsel_url", { length: 500 }),
    photoPopTelkomselUpdatedAt: datetime("photo_pop_telkomsel_updated_at"),
    photoPopKompetitorUrl: varchar("photo_pop_kompetitor_url", { length: 500 }),
    photoPopKompetitorUpdatedAt: datetime("photo_pop_kompetitor_updated_at"),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    index("mitra_outlets_public_token_idx").on(table.publicToken),
    index("mitra_outlets_name_idx").on(table.name),
    index("mitra_outlets_owner_phone_idx").on(table.ownerPhone),
    index("mitra_outlets_territory_idx").on(table.territoryId),
    index("mitra_outlets_status_idx").on(table.status),
    index("mitra_outlets_salesforce_idx").on(table.salesforceId),
]);

export const mitraOutletDetails = mysqlTable("mitra_outlet_details", {
    outletId: varchar("outlet_id", { length: 36 }).primaryKey().references(() => mitraOutlets.id, { onDelete: "cascade" }),
    sellthruDigiposJson: json("sellthru_digipos_json").$type<MitraDetailGroup>(),
    sellthruNotaJson: json("sellthru_nota_json").$type<MitraDetailGroup>(),
    rechargeDigiposJson: json("recharge_digipos_json").$type<MitraDetailGroup>(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

/**
 * Market share operator per kecamatan, dipakai halaman detail outlet setelah OTP.
 *
 * Dikunci pada pasangan kabupaten + kecamatan, bukan kecamatan saja: nama kecamatan
 * berulang antar kabupaten (Jalaksana, Kesambi, dan seterusnya bisa ada di lebih dari
 * satu daerah), jadi kecamatan saja akan menempelkan angka yang salah ke outlet.
 *
 * Satu baris per wilayah tanpa kolom periode -- angka terbaru menimpa yang lama. Kalau
 * nanti perlu riwayat bulanan, tambahkan period_ym ke tabel dan ke unique index-nya.
 */
export const mitraMarketShares = mysqlTable("mitra_market_shares", {
    id: varchar("id", { length: 36 }).primaryKey(),
    kabupaten: varchar("kabupaten", { length: 255 }).notNull(),
    kecamatan: varchar("kecamatan", { length: 255 }).notNull(),
    telkomsel: decimal("telkomsel", { precision: 5, scale: 2 }).notNull().default("0.00"),
    xl: decimal("xl", { precision: 5, scale: 2 }).notNull().default("0.00"),
    axis: decimal("axis", { precision: 5, scale: 2 }).notNull().default("0.00"),
    smartfren: decimal("smartfren", { precision: 5, scale: 2 }).notNull().default("0.00"),
    indosat: decimal("indosat", { precision: 5, scale: 2 }).notNull().default("0.00"),
    tri: decimal("tri", { precision: 5, scale: 2 }).notNull().default("0.00"),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    uniqueIndex("mitra_market_share_area_idx").on(table.kabupaten, table.kecamatan),
]);

/**
 * Template kartu QR 90 x 55 mm.
 *
 * Semua koordinat dan ukuran disimpan dalam MILIMETER, bukan piksel: kartunya benda
 * cetak, dan mm adalah satuan yang sama dipakai editor maupun pembuat PDF. Kalau piksel
 * yang disimpan, setiap perubahan skala pratinjau akan menggeser hasil cetaknya.
 *
 * Elemen teks disimpan sebagai JSON karena jumlah dan jenisnya bebas; QR, logo, dan latar
 * dapat kolomnya sendiri karena selalu ada tepat satu.
 */
export const mitraQrTemplates = mysqlTable("mitra_qr_templates", {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    backgroundColor: varchar("background_color", { length: 20 }).notNull().default("#ffffff"),
    backgroundImageUrl: varchar("background_image_url", { length: 500 }),
    logoUrl: varchar("logo_url", { length: 500 }),
    logoX: decimal("logo_x", { precision: 6, scale: 2 }).notNull().default("4.00"),
    logoY: decimal("logo_y", { precision: 6, scale: 2 }).notNull().default("4.00"),
    logoWidth: decimal("logo_width", { precision: 6, scale: 2 }).notNull().default("18.00"),
    qrX: decimal("qr_x", { precision: 6, scale: 2 }).notNull().default("5.00"),
    qrY: decimal("qr_y", { precision: 6, scale: 2 }).notNull().default("14.00"),
    qrSize: decimal("qr_size", { precision: 6, scale: 2 }).notNull().default("34.00"),
    elementsJson: json("elements_json").$type<unknown[]>(),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    index("mitra_qr_templates_default_idx").on(table.isDefault),
]);

export const mitraMetricDefs = mysqlTable("mitra_metric_defs", {
    id: varchar("id", { length: 36 }).primaryKey(),
    key: varchar("key", { length: 120 }).notNull().unique(),
    label: varchar("label", { length: 255 }).notNull(),
    unit: varchar("unit", { length: 50 }),
    aggregation: mysqlEnum("aggregation", ["SUM", "AVG", "LAST"]).notNull().default("SUM"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: datetime("created_at").notNull(),
}, (table) => [
    index("mitra_metric_defs_public_idx").on(table.isPublic),
]);

export const mitraOutletMetrics = mysqlTable("mitra_outlet_metrics", {
    id: varchar("id", { length: 36 }).primaryKey(),
    outletId: varchar("outlet_id", { length: 36 }).notNull().references(() => mitraOutlets.id, { onDelete: "cascade" }),
    metricDefId: varchar("metric_def_id", { length: 36 }).notNull().references(() => mitraMetricDefs.id, { onDelete: "cascade" }),
    periodYm: varchar("period_ym", { length: 7 }).notNull(),
    value: decimal("value", { precision: 18, scale: 2 }).notNull().default("0.00"),
    sourceBatchId: varchar("source_batch_id", { length: 36 }),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    uniqueIndex("mitra_outlet_metrics_unique_idx").on(table.outletId, table.metricDefId, table.periodYm),
    index("mitra_outlet_metrics_period_idx").on(table.periodYm),
    index("mitra_outlet_metrics_batch_idx").on(table.sourceBatchId),
]);

export const mitraImportBatches = mysqlTable("mitra_import_batches", {
    id: varchar("id", { length: 36 }).primaryKey(),
    type: varchar("type", { length: 50 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    rowCount: int("row_count").notNull().default(0),
    status: mysqlEnum("status", ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "ROLLED_BACK"]).notNull().default("PENDING"),
    errorLog: json("error_log").$type<unknown[]>(),
    previewJson: json("preview_json").$type<unknown[]>(),
    rollbackJson: json("rollback_json").$type<unknown[]>(),
    createdBy: varchar("created_by", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
    createdAt: datetime("created_at").notNull(),
    rolledBackAt: datetime("rolled_back_at"),
}, (table) => [
    index("mitra_import_batches_type_idx").on(table.type),
    index("mitra_import_batches_status_idx").on(table.status),
]);

export const mitraWhitelistNumbers = mysqlTable("mitra_whitelist_numbers", {
    id: varchar("id", { length: 36 }).primaryKey(),
    phoneE164: varchar("phone_e164", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }),
    /** Status pemegang nomor: Outlet Owner, Salesforce, Manager, Organik Telkomsel, dan sejenisnya. */
    keterangan: varchar("keterangan", { length: 255 }),
    /**
     * TERRITORY diganti TAP: territory adalah pengelompokan internal yang jarang diisi,
     * sedangkan TAP sudah melekat di tiap outlet dan itu yang dipakai orang lapangan.
     * Nilainya nama TAP apa adanya, dicocokkan ke mitra_outlets.tap.
     */
    scope: mysqlEnum("scope", ["ALL", "OUTLET", "TAP"]).notNull().default("ALL"),
    outletId: varchar("outlet_id", { length: 36 }).references(() => mitraOutlets.id, { onDelete: "cascade" }),
    tap: varchar("tap", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: varchar("created_by", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
    // FK dinamai eksplisit: nama turunan otomatis Drizzle untuk kolom ini
    // ("mitra_whitelist_numbers_source_batch_id_mitra_import_batches_id_fk")
    // panjangnya 66 karakter, melewati batas 64 karakter identifier MySQL,
    // sehingga membuat tabel ini dari nol selalu gagal ER_TOO_LONG_IDENT.
    sourceBatchId: varchar("source_batch_id", { length: 36 }),
    expiresAt: datetime("expires_at"),
    createdAt: datetime("created_at").notNull(),
}, (table) => [
    index("mitra_whitelist_phone_idx").on(table.phoneE164),
    index("mitra_whitelist_scope_idx").on(table.scope),
    index("mitra_whitelist_outlet_idx").on(table.outletId),
    index("mitra_whitelist_tap_idx").on(table.tap),
    foreignKey({
        columns: [table.sourceBatchId],
        foreignColumns: [mitraImportBatches.id],
        name: "mitra_whitelist_source_batch_fk",
    }).onDelete("set null"),
]);

export const mitraOtpRequests = mysqlTable("mitra_otp_requests", {
    id: varchar("id", { length: 36 }).primaryKey(),
    phoneE164: varchar("phone_e164", { length: 50 }).notNull(),
    outletId: varchar("outlet_id", { length: 36 }).notNull().references(() => mitraOutlets.id, { onDelete: "cascade" }),
    whitelistId: varchar("whitelist_id", { length: 36 }).references(() => mitraWhitelistNumbers.id, { onDelete: "set null" }),
    codeHash: varchar("code_hash", { length: 255 }).notNull(),
    codeSalt: varchar("code_salt", { length: 255 }).notNull(),
    purpose: mysqlEnum("purpose", ["OUTLET_DETAIL"]).notNull().default("OUTLET_DETAIL"),
    attempts: int("attempts").notNull().default(0),
    expiresAt: datetime("expires_at").notNull(),
    verifiedAt: datetime("verified_at"),
    ip: varchar("ip", { length: 120 }),
    userAgent: text("user_agent"),
    createdAt: datetime("created_at").notNull(),
}, (table) => [
    index("mitra_otp_phone_idx").on(table.phoneE164),
    index("mitra_otp_outlet_idx").on(table.outletId),
    index("mitra_otp_created_idx").on(table.createdAt),
]);

export const mitraDetailSessions = mysqlTable("mitra_detail_sessions", {
    id: varchar("id", { length: 36 }).primaryKey(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
    phoneE164: varchar("phone_e164", { length: 50 }).notNull(),
    outletId: varchar("outlet_id", { length: 36 }).notNull().references(() => mitraOutlets.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at").notNull(),
    createdAt: datetime("created_at").notNull(),
}, (table) => [
    index("mitra_detail_sessions_outlet_idx").on(table.outletId),
    index("mitra_detail_sessions_expiry_idx").on(table.expiresAt),
]);

/**
 * Jejak perubahan outlet yang bisa dilakukan dua pihak berbeda: mitra pemegang OTP
 * (diidentifikasi nomor WhatsApp-nya dari mitra_detail_sessions) dan admin (user id).
 * Karena itu keduanya nullable -- yang terisi menentukan siapa pelakunya.
 *
 * Terpisah dari admin_audit_logs supaya riwayatnya bisa ditampilkan di halaman detail
 * publik tanpa ikut membuka jejak perubahan seluruh sistem.
 */
export const mitraOutletEditLogs = mysqlTable("mitra_outlet_edit_logs", {
    id: varchar("id", { length: 36 }).primaryKey(),
    outletId: varchar("outlet_id", { length: 36 }).notNull().references(() => mitraOutlets.id, { onDelete: "cascade" }),
    actorType: mysqlEnum("actor_type", ["MITRA", "ADMIN"]).notNull(),
    actorPhone: varchar("actor_phone", { length: 50 }),
    actorUserId: varchar("actor_user_id", { length: 36 }),
    action: mysqlEnum("action", ["PHOTO", "LOCATION", "BRANDING"]).notNull(),
    beforeJson: json("before_json").$type<Record<string, unknown>>(),
    afterJson: json("after_json").$type<Record<string, unknown>>(),
    ip: varchar("ip", { length: 120 }),
    createdAt: datetime("created_at").notNull(),
}, (table) => [
    index("mitra_outlet_edit_logs_outlet_idx").on(table.outletId),
    index("mitra_outlet_edit_logs_created_idx").on(table.createdAt),
]);

export const mitraWhitelistUsageLogs = mysqlTable("mitra_whitelist_usage_logs", {
    id: varchar("id", { length: 36 }).primaryKey(),
    // Sama seperti mitra_whitelist_numbers.source_batch_id: nama FK turunan
    // otomatis ("mitra_whitelist_usage_logs_whitelist_id_mitra_whitelist_numbers_id_fk")
    // panjangnya 69 karakter, melewati batas 64 karakter identifier MySQL.
    whitelistId: varchar("whitelist_id", { length: 36 }),
    phoneE164: varchar("phone_e164", { length: 50 }).notNull(),
    outletId: varchar("outlet_id", { length: 36 }).notNull().references(() => mitraOutlets.id, { onDelete: "cascade" }),
    action: mysqlEnum("action", ["OTP_REQUESTED", "OTP_VERIFIED", "OTP_REJECTED"]).notNull(),
    ip: varchar("ip", { length: 120 }),
    createdAt: datetime("created_at").notNull(),
}, (table) => [
    index("mitra_whitelist_usage_phone_idx").on(table.phoneE164),
    index("mitra_whitelist_usage_outlet_idx").on(table.outletId),
    foreignKey({
        columns: [table.whitelistId],
        foreignColumns: [mitraWhitelistNumbers.id],
        name: "mitra_whitelist_usage_whitelist_fk",
    }).onDelete("set null"),
]);

export const mitraPrograms = mysqlTable("mitra_programs", {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    descriptionMd: text("description_md"),
    mechanismMd: text("mechanism_md"),
    periodStart: datetime("period_start").notNull(),
    periodEnd: datetime("period_end").notNull(),
    status: mysqlEnum("status", ["DRAFT", "ACTIVE", "ENDED", "PUBLISHED"]).notNull().default("DRAFT"),
    rankingMode: mysqlEnum("ranking_mode", ["POINT", "RANK"]).notNull().default("POINT"),
    tieBreaker: varchar("tie_breaker", { length: 120 }),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    index("mitra_programs_public_idx").on(table.isPublic),
    index("mitra_programs_status_idx").on(table.status),
]);

export const mitraProgramParams = mysqlTable("mitra_program_params", {
    id: varchar("id", { length: 36 }).primaryKey(),
    programId: varchar("program_id", { length: 36 }).notNull().references(() => mitraPrograms.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 120 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    unit: varchar("unit", { length: 50 }),
    weight: decimal("weight", { precision: 10, scale: 4 }).notNull().default("1.0000"),
    aggregation: mysqlEnum("aggregation", ["SUM", "AVG", "LAST"]).notNull().default("SUM"),
    sortOrder: int("sort_order").notNull().default(0),
}, (table) => [
    uniqueIndex("mitra_program_params_unique_idx").on(table.programId, table.key),
    index("mitra_program_params_program_idx").on(table.programId),
]);

export const mitraProgramParticipants = mysqlTable("mitra_program_participants", {
    programId: varchar("program_id", { length: 36 }).notNull().references(() => mitraPrograms.id, { onDelete: "cascade" }),
    outletId: varchar("outlet_id", { length: 36 }).notNull().references(() => mitraOutlets.id, { onDelete: "cascade" }),
    joinedAt: datetime("joined_at").notNull(),
}, (table) => [
    primaryKey({ columns: [table.programId, table.outletId], name: "mitra_program_participants_pk" }),
    index("mitra_program_participants_outlet_idx").on(table.outletId),
]);

export const mitraProgramScores = mysqlTable("mitra_program_scores", {
    id: varchar("id", { length: 36 }).primaryKey(),
    programId: varchar("program_id", { length: 36 }).notNull().references(() => mitraPrograms.id, { onDelete: "cascade" }),
    outletId: varchar("outlet_id", { length: 36 }).notNull().references(() => mitraOutlets.id, { onDelete: "cascade" }),
    paramId: varchar("param_id", { length: 36 }).notNull().references(() => mitraProgramParams.id, { onDelete: "cascade" }),
    rawValue: decimal("raw_value", { precision: 18, scale: 2 }).notNull().default("0.00"),
    points: decimal("points", { precision: 18, scale: 2 }).notNull().default("0.00"),
    periodYm: varchar("period_ym", { length: 7 }).notNull(),
    batchId: varchar("batch_id", { length: 36 }).references(() => mitraImportBatches.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    uniqueIndex("mitra_program_scores_unique_idx").on(table.programId, table.outletId, table.paramId, table.periodYm),
    index("mitra_program_scores_outlet_idx").on(table.outletId),
    index("mitra_program_scores_batch_idx").on(table.batchId),
]);

export const mitraProgramLeaderboard = mysqlTable("mitra_program_leaderboard", {
    id: varchar("id", { length: 36 }).primaryKey(),
    programId: varchar("program_id", { length: 36 }).notNull().references(() => mitraPrograms.id, { onDelete: "cascade" }),
    outletId: varchar("outlet_id", { length: 36 }).notNull().references(() => mitraOutlets.id, { onDelete: "cascade" }),
    totalPoints: decimal("total_points", { precision: 18, scale: 2 }).notNull().default("0.00"),
    rank: int("rank").notNull(),
    prevRank: int("prev_rank"),
    computedAt: datetime("computed_at").notNull(),
}, (table) => [
    uniqueIndex("mitra_program_leaderboard_unique_idx").on(table.programId, table.outletId),
    index("mitra_program_leaderboard_rank_idx").on(table.programId, table.rank),
]);

export const mitraProgramWinners = mysqlTable("mitra_program_winners", {
    id: varchar("id", { length: 36 }).primaryKey(),
    programId: varchar("program_id", { length: 36 }).notNull().references(() => mitraPrograms.id, { onDelete: "cascade" }),
    outletId: varchar("outlet_id", { length: 36 }).notNull().references(() => mitraOutlets.id, { onDelete: "cascade" }),
    rank: int("rank").notNull(),
    prizeLabel: varchar("prize_label", { length: 255 }),
    isPublished: boolean("is_published").notNull().default(false),
}, (table) => [
    index("mitra_program_winners_program_idx").on(table.programId),
    index("mitra_program_winners_public_idx").on(table.isPublished),
]);

export const mitraAuditLogs = mysqlTable("mitra_audit_logs", {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entity: varchar("entity", { length: 120 }).notNull(),
    entityId: varchar("entity_id", { length: 36 }),
    diffJson: json("diff_json").$type<Record<string, unknown>>(),
    ip: varchar("ip", { length: 120 }),
    createdAt: datetime("created_at").notNull(),
}, (table) => [
    index("mitra_audit_user_idx").on(table.userId),
    index("mitra_audit_entity_idx").on(table.entity, table.entityId),
    index("mitra_audit_created_idx").on(table.createdAt),
]);

export const mitraUserProfilesRelations = relations(mitraUserProfiles, ({ one }) => ({
    user: one(user, { fields: [mitraUserProfiles.userId], references: [user.id] }),
}));

export const mitraTerritoriesRelations = relations(mitraTerritories, ({ many }) => ({
    userTerritories: many(mitraUserTerritories),
    outlets: many(mitraOutlets),
}));

export const mitraUserTerritoriesRelations = relations(mitraUserTerritories, ({ one }) => ({
    user: one(user, { fields: [mitraUserTerritories.userId], references: [user.id] }),
    territory: one(mitraTerritories, { fields: [mitraUserTerritories.territoryId], references: [mitraTerritories.id] }),
}));

export const mitraOutletsRelations = relations(mitraOutlets, ({ one, many }) => ({
    territory: one(mitraTerritories, { fields: [mitraOutlets.territoryId], references: [mitraTerritories.id] }),
    details: one(mitraOutletDetails),
    metrics: many(mitraOutletMetrics),
    programParticipants: many(mitraProgramParticipants),
    leaderboardRows: many(mitraProgramLeaderboard),
}));

export const mitraOutletDetailsRelations = relations(mitraOutletDetails, ({ one }) => ({
    outlet: one(mitraOutlets, { fields: [mitraOutletDetails.outletId], references: [mitraOutlets.id] }),
}));

export const mitraMetricDefsRelations = relations(mitraMetricDefs, ({ many }) => ({
    metrics: many(mitraOutletMetrics),
}));

export const mitraOutletMetricsRelations = relations(mitraOutletMetrics, ({ one }) => ({
    outlet: one(mitraOutlets, { fields: [mitraOutletMetrics.outletId], references: [mitraOutlets.id] }),
    metricDef: one(mitraMetricDefs, { fields: [mitraOutletMetrics.metricDefId], references: [mitraMetricDefs.id] }),
}));

export const mitraProgramsRelations = relations(mitraPrograms, ({ many }) => ({
    params: many(mitraProgramParams),
    participants: many(mitraProgramParticipants),
    leaderboard: many(mitraProgramLeaderboard),
    winners: many(mitraProgramWinners),
}));

export const mitraProgramParamsRelations = relations(mitraProgramParams, ({ one, many }) => ({
    program: one(mitraPrograms, { fields: [mitraProgramParams.programId], references: [mitraPrograms.id] }),
    scores: many(mitraProgramScores),
}));

export const mitraProgramParticipantsRelations = relations(mitraProgramParticipants, ({ one }) => ({
    program: one(mitraPrograms, { fields: [mitraProgramParticipants.programId], references: [mitraPrograms.id] }),
    outlet: one(mitraOutlets, { fields: [mitraProgramParticipants.outletId], references: [mitraOutlets.id] }),
}));

export const mitraProgramScoresRelations = relations(mitraProgramScores, ({ one }) => ({
    program: one(mitraPrograms, { fields: [mitraProgramScores.programId], references: [mitraPrograms.id] }),
    outlet: one(mitraOutlets, { fields: [mitraProgramScores.outletId], references: [mitraOutlets.id] }),
    param: one(mitraProgramParams, { fields: [mitraProgramScores.paramId], references: [mitraProgramParams.id] }),
}));

export const mitraProgramLeaderboardRelations = relations(mitraProgramLeaderboard, ({ one }) => ({
    program: one(mitraPrograms, { fields: [mitraProgramLeaderboard.programId], references: [mitraPrograms.id] }),
    outlet: one(mitraOutlets, { fields: [mitraProgramLeaderboard.outletId], references: [mitraOutlets.id] }),
}));

export const mitraProgramWinnersRelations = relations(mitraProgramWinners, ({ one }) => ({
    program: one(mitraPrograms, { fields: [mitraProgramWinners.programId], references: [mitraPrograms.id] }),
    outlet: one(mitraOutlets, { fields: [mitraProgramWinners.outletId], references: [mitraOutlets.id] }),
}));

// ========== RBAC Umum (PRD Fase 0 - prd-total-revamp.md) ==========
//
// Menggantikan mitra_user_profiles/mitra_user_territories sebagai sumber role untuk SELURUH
// dashboard admin, bukan hanya modul Mitra. mitra_user_profiles/mitra_user_territories tetap
// dipertahankan untuk sementara (lihat migrasi 0003) dan dihapus di Fase 5 setelah observasi.

export type AdminRole = "SUPER_ADMIN" | "ADMIN_INPUT" | "MANAGER" | "SUPERVISOR" | "SALESFORCE";

export const adminUserProfiles = mysqlTable("admin_user_profiles", {
    userId: varchar("user_id", { length: 36 }).primaryKey().references(() => user.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 50 }),
    role: mysqlEnum("role", ["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]).notNull().default("MANAGER"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: datetime("last_login_at"),
    failedLoginAttempts: int("failed_login_attempts").notNull().default(0),
    lastFailedLoginAt: datetime("last_failed_login_at"),
    lockedUntil: datetime("locked_until"),
    createdAt: datetime("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [
    index("admin_user_profiles_role_idx").on(table.role),
]);

export const adminUserTerritories = mysqlTable("admin_user_territories", {
    userId: varchar("user_id", { length: 36 }).notNull().references(() => user.id, { onDelete: "cascade" }),
    territoryId: varchar("territory_id", { length: 36 }).notNull().references(() => mitraTerritories.id, { onDelete: "cascade" }),
}, (table) => [
    primaryKey({ columns: [table.userId, table.territoryId], name: "admin_user_territories_pk" }),
    index("admin_user_territories_territory_idx").on(table.territoryId),
]);

export const adminAuditLogs = mysqlTable("admin_audit_logs", {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entity: varchar("entity", { length: 120 }).notNull(),
    entityId: varchar("entity_id", { length: 36 }),
    diffJson: json("diff_json").$type<Record<string, unknown>>(),
    ip: varchar("ip", { length: 120 }),
    createdAt: datetime("created_at").notNull(),
}, (table) => [
    index("admin_audit_user_idx").on(table.userId),
    index("admin_audit_entity_idx").on(table.entity, table.entityId),
    index("admin_audit_created_idx").on(table.createdAt),
]);

export const adminUserProfilesRelations = relations(adminUserProfiles, ({ one, many }) => ({
    user: one(user, { fields: [adminUserProfiles.userId], references: [user.id] }),
    territories: many(adminUserTerritories),
}));

export const adminUserTerritoriesRelations = relations(adminUserTerritories, ({ one }) => ({
    user: one(user, { fields: [adminUserTerritories.userId], references: [user.id] }),
    territory: one(mitraTerritories, { fields: [adminUserTerritories.territoryId], references: [mitraTerritories.id] }),
}));
