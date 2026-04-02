import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import mysql from "mysql2/promise";
import { siteSettings, heroSlides, programs, user, account, dynamicForms, formFields, formSubmissions, submissionValues, winners } from "./schema";
import { v4 as uuid } from "uuid";
import { scryptSync, randomBytes } from "crypto";
import { programs as mockPrograms, heroSlides as mockSlides } from "../lib/mock-data";

function hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    return `${salt}:${derivedKey.toString("hex")}`;
}

// ── Mock participants per period ──────────────────────────────────────────
const mockParticipants = {
    "Periode Januari 2026": [
        { name: "Agus Salim", phone: "081234567890" },
        { name: "Dewi Rahayu", phone: "082345678901" },
        { name: "Budi Santoso", phone: "083456789012" },
        { name: "Siti Aminah", phone: "085678901234" },
        { name: "Rudi Hermawan", phone: "087890123456" },
        { name: "Ningsih Wulandari", phone: "089012345678" },
        { name: "Hendra Gunawan", phone: "081122334455" },
        { name: "Fitri Handayani", phone: "082233445566" },
        { name: "Dian Permata", phone: "083344556677" },
        { name: "Wahyu Setiawan", phone: "084455667788" },
    ],
    "Periode Februari 2026": [
        { name: "Eko Prasetyo", phone: "085566778899" },
        { name: "Lina Marlina", phone: "086677889900" },
        { name: "Fajar Nugroho", phone: "087788990011" },
        { name: "Rina Septiani", phone: "088899001122" },
        { name: "Yusuf Habibi", phone: "089900112233" },
        { name: "Ani Kurniawati", phone: "081011223344" },
        { name: "Rizki Maulana", phone: "082122334455" },
        { name: "Sri Mulyani", phone: "083233445566" },
        { name: "Tono Suharto", phone: "084344556677" },
        { name: "Vina Amelia", phone: "085455667788" },
        { name: "Guntur Wicaksono", phone: "086566778899" },
        { name: "Mira Susanti", phone: "087677889900" },
    ],
};

const mockWinners = {
    "Periode Januari 2026": [
        { name: "Agus Salim", phone: "081234567890", outlet: "Outlet Cirebon Timur", photoUrl: "" },
        { name: "Dewi Rahayu", phone: "082345678901", outlet: "Outlet Kesambi", photoUrl: "" },
        { name: "Budi Santoso", phone: "083456789012", outlet: "Outlet Kuningan Kota", photoUrl: "" },
    ],
    "Periode Februari 2026": [
        { name: "Eko Prasetyo", phone: "085566778899", outlet: "Outlet Sumber Cirebon", photoUrl: "" },
        { name: "Lina Marlina", phone: "086677889900", outlet: "Outlet Sindang Laut", photoUrl: "" },
    ],
};

// ── Period date helpers ──────────────────────────────────────────────────
function randomDateInRange(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

const JAN_START = new Date("2026-01-01");
const JAN_END = new Date("2026-01-31");
const FEB_START = new Date("2026-02-01");
const FEB_END = new Date("2026-02-28");

async function seed() {
    const connection = await mysql.createConnection(
        process.env.DATABASE_URL || "mysql://root:@localhost:3306/abk_ciraya"
    );
    const db = drizzle({ client: connection });

    console.log("🌱 Seeding database...");

    // 1. Create admin user directly in DB
    console.log("Creating admin user...");
    try {
        const userId = uuid();
        const hashedPassword = hashPassword("admin123");
        const now = new Date();

        await db.insert(user).values({
            id: userId,
            name: "Admin",
            email: "admin@abkciraya.com",
            emailVerified: false,
            createdAt: now,
            updatedAt: now,
        });

        await db.insert(account).values({
            id: uuid(),
            accountId: userId,
            providerId: "credential",
            userId: userId,
            password: hashedPassword,
            createdAt: now,
            updatedAt: now,
        });

        console.log("✅ Admin user created: admin@abkciraya.com / admin123");
    } catch (err: unknown) {
        const mysqlErr = err as { code?: string };
        if (mysqlErr.code === "ER_DUP_ENTRY") {
            console.log("⚠️ Admin user already exists, skipping.");
        } else {
            throw err;
        }
    }

    // 2. Default site settings
    console.log("Creating site settings...");
    const defaultSettings = [
        { key: "site_name", value: "ABK Ciraya", type: "text" },
        { key: "site_description", value: "PT Arena Bola Keluarga Ciraya", type: "text" },
        { key: "about_content", value: "<p>Tentang ABK Ciraya</p>", type: "text" },
        { key: "footer_phone", value: "+62 851-6882-2280", type: "text" },
        { key: "footer_email", value: "info@abkciraya.com", type: "text" },
        { key: "stats_areas", value: "3", type: "text" },
        { key: "stats_partners", value: "55+", type: "text" },
        { key: "stats_outlets", value: "Ribuan", type: "text" },
        { key: "whatsapp", value: "+62 851-6882-2280", type: "text" },
        { key: "whatsapp_url", value: "https://wa.me/6285168822280", type: "text" },
        { key: "instagram_url", value: "https://www.instagram.com/agrabudikomunika", type: "text" },
        { key: "instagram_handle", value: "@agrabudikomunika", type: "text" },
        { key: "facebook_url", value: "https://tsel.id/fbciraya", type: "text" },
        { key: "facebook_name", value: "ABK Ciraya", type: "text" },
        {
            key: "office_data", value: JSON.stringify([
                { city: "CIREBON", label: "Kantor Pusat Cirebon", address: "Jl. Pemuda Raya No.21B, Sunyaragi, Kec. Kesambi, Kota Cirebon, Jawa Barat 45132", phone: "+62 851-6882-2280", mapUrl: "https://www.google.com/maps/search/Jl.+Pemuda+Raya+No.21B+Sunyaragi+Kesambi+Kota+Cirebon" },
                { city: "KUNINGAN", label: "Kantor Cabang Kuningan", address: "Jl. Siliwangi No.45, Purwawinangun, Kec. Kuningan, Kabupaten Kuningan, Jawa Barat 45512", phone: "+62 851-6882-2280", mapUrl: "https://www.google.com/maps/search/Jl.+Siliwangi+No.45+Purwawinangun+Kuningan" },
            ]), type: "json"
        },
    ];

    for (const setting of defaultSettings) {
        try {
            await db.insert(siteSettings).values({
                id: uuid(),
                key: setting.key,
                value: setting.value,
                type: setting.type,
            });
        } catch {
            // Skip if already exists
        }
    }
    console.log("✅ Site settings created");

    // 3. Import Hero Slides from Mock Data
    console.log("Importing hero slides...");
    try {
        await db.delete(heroSlides);
        const formattedSlides = mockSlides.map((slide, index) => ({
            id: uuid(),
            title: slide.title,
            subtitle: slide.subtitle,
            ctaText: slide.cta,
            ctaLink: slide.ctaLink,
            bgColor: slide.bgColor,
            sortOrder: index,
            isActive: true,
            createdAt: new Date(),
        }));
        await db.insert(heroSlides).values(formattedSlides);
        console.log("✅ Hero slides imported");
    } catch (err) {
        console.log("⚠️ Failed to import hero slides:", err);
    }

    // 4. Import Programs from Mock Data
    console.log("Importing programs...");
    let programId = "";
    try {
        const existingPrograms = await db.select().from(programs).limit(1);
        if (existingPrograms.length === 0) {
            const formattedPrograms = mockPrograms.map((prog, index) => ({
                id: prog.id,
                slug: prog.slug,
                title: prog.title,
                description: prog.description,
                thumbnail: prog.thumbnail,
                category: "pelanggan",
                period: prog.period,
                content: prog.content,
                terms: JSON.stringify(prog.terms),
                mechanics: JSON.stringify(prog.mechanics),
                status: "published",
                sortOrder: index,
                createdAt: new Date(),
            }));
            await db.insert(programs).values(formattedPrograms);
            programId = formattedPrograms[0].id;
            console.log("✅ Programs imported from mock data");
        } else {
            programId = existingPrograms[0].id;
            console.log("⚠️ Programs table already contains data, skipping mock import.");
        }
    } catch (err) {
        console.log("⚠️ Failed to import programs:", err);
    }

    // 5. Seed mock form submissions & winners (only if no existing forms)
    if (programId) {
        console.log("Seeding mock form & participants...");
        try {
            const existingForms = await db.select().from(dynamicForms).limit(1);
            if (existingForms.length > 0) {
                console.log("⚠️ Forms already exist, skipping mock submissions.");
            } else {
                // Create a dynamic form for the first program
                const formId = uuid();
                await db.insert(dynamicForms).values({
                    id: formId,
                    programId: programId,
                    title: "Form Pendaftaran Undian Mingguan",
                    description: "Daftarkan diri Anda untuk mengikuti undian berhadiah mingguan Telkomsel.",
                    formSchema: "[]",
                    isActive: true,
                    createdAt: new Date(),
                });

                // Create form fields
                const namaFieldId = uuid();
                const teleponFieldId = uuid();
                await db.insert(formFields).values([
                    {
                        id: namaFieldId,
                        formId: formId,
                        fieldType: "text",
                        label: "Nama Lengkap",
                        placeholder: "Masukkan nama lengkap",
                        hintText: "",
                        isRequired: true,
                        options: "[]",
                        sortOrder: 0,
                    },
                    {
                        id: teleponFieldId,
                        formId: formId,
                        fieldType: "text",
                        label: "Nomor Telepon",
                        placeholder: "Contoh: 08123456789",
                        hintText: "",
                        isRequired: true,
                        options: "[]",
                        sortOrder: 1,
                    },
                ]);
                console.log("✅ Form and fields created");

                // Insert submissions per period
                for (const [period, participants] of Object.entries(mockParticipants)) {
                    const isJan = period.includes("Januari");
                    for (const p of participants) {
                        const submissionId = uuid();
                        const submittedAt = randomDateInRange(
                            isJan ? JAN_START : FEB_START,
                            isJan ? JAN_END : FEB_END
                        );
                        await db.insert(formSubmissions).values({
                            id: submissionId,
                            formId: formId,
                            period: period,
                            status: "approved",
                            submittedAt: submittedAt,
                        });
                        await db.insert(submissionValues).values([
                            { id: uuid(), submissionId, fieldId: namaFieldId, value: p.name, filePath: "" },
                            { id: uuid(), submissionId, fieldId: teleponFieldId, value: p.phone, filePath: "" },
                        ]);
                    }
                    console.log(`  ✅ Inserted ${participants.length} participants for ${period}`);
                }

                // Insert winners per period
                for (const [period, periodWinners] of Object.entries(mockWinners)) {
                    const isJan = period.includes("Januari");
                    for (const w of periodWinners) {
                        // Find a matching submission for this winner
                        const subs = await db.select().from(formSubmissions).where(
                            eq(formSubmissions.period, period)
                        ) as { id: string; period: string }[];
                        const matchingSub = subs.find(s => s.period === period);
                        if (!matchingSub) continue;
                        const drawnAt = randomDateInRange(
                            isJan ? JAN_END : FEB_END,
                            isJan ? new Date("2026-02-07") : new Date("2026-03-07")
                        );
                        try {
                            await db.insert(winners).values({
                                id: uuid(),
                                programId: programId,
                                submissionId: matchingSub.id,
                                name: w.name,
                                phone: w.phone,
                                outlet: w.outlet,
                                period: period,
                                photoUrl: w.photoUrl,
                                drawnAt: drawnAt,
                            });
                        } catch {
                            // submissionId must be unique — skip if already used
                        }
                    }
                    console.log(`  ✅ Inserted winners for ${period}`);
                }
            }
        } catch (err) {
            console.log("⚠️ Failed to seed mock submissions/winners:", err);
            console.error(err);
        }
    }

    // 6. Seed Kalkulator Cuan data
    console.log("\nSeeding Kalkulator Cuan...");
    try {
        const { cuanCategories, cuanBrands, cuanProducts } = await import("./schema");
        const existingCuanProducts = await db.select().from(cuanProducts).limit(1);

        if (existingCuanProducts.length > 0) {
            console.log("⚠️ Cuan products already exist, skipping.");
        } else {
            // Categories
            const cuanCategoryData = [
                { name: "Pulsa" },
                { name: "Paket Internet" },
                { name: "Paket Digital" },
                { name: "Paket Roaming" },
                { name: "Inject Voucher Fisik" },
                { name: "Aktivasi Perdana" },
            ];

            const cuanCategoryIds: Record<string, string> = {};
            for (const cat of cuanCategoryData) {
                const id = uuid();
                cuanCategoryIds[cat.name] = id;
                await db.insert(cuanCategories).values({ id, name: cat.name, createdAt: new Date() });
            }
            console.log(`  ✅ ${cuanCategoryData.length} kategori cuan ditambahkan`);

            // Brands
            const cuanBrandData = [
                { name: "Simpati" },
                { name: "Kartu AS" },
                { name: "byU" },
                { name: "Telkomsel Orbit" },
                { name: "PPOB" },
                { name: "e-Wallet" },
            ];

            const cuanBrandIds: Record<string, string> = {};
            for (const brand of cuanBrandData) {
                const id = uuid();
                cuanBrandIds[brand.name] = id;
                await db.insert(cuanBrands).values({ id, name: brand.name, createdAt: new Date() });
            }
            console.log(`  ✅ ${cuanBrandData.length} brand cuan ditambahkan`);

            // Products
            const cuanProductData = [
                // PULSA - Simpati
                { name: "Pulsa 5rb", category: "Pulsa", brand: "Simpati", capital: 4800, selling: 5500, cashback: 100, hot: false },
                { name: "Pulsa 10rb", category: "Pulsa", brand: "Simpati", capital: 9700, selling: 11000, cashback: 200, hot: true },
                { name: "Pulsa 15rb", category: "Pulsa", brand: "Simpati", capital: 14500, selling: 16000, cashback: 200, hot: false },
                { name: "Pulsa 20rb", category: "Pulsa", brand: "Simpati", capital: 19500, selling: 21500, cashback: 300, hot: false },
                { name: "Pulsa 25rb", category: "Pulsa", brand: "Simpati", capital: 24300, selling: 27000, cashback: 300, hot: true },
                { name: "Pulsa 50rb", category: "Pulsa", brand: "Simpati", capital: 48500, selling: 52000, cashback: 500, hot: true },
                { name: "Pulsa 100rb", category: "Pulsa", brand: "Simpati", capital: 97000, selling: 103000, cashback: 1000, hot: false },
                // PULSA - Kartu AS
                { name: "Pulsa 5rb", category: "Pulsa", brand: "Kartu AS", capital: 4850, selling: 5500, cashback: 100, hot: false },
                { name: "Pulsa 10rb", category: "Pulsa", brand: "Kartu AS", capital: 9750, selling: 11000, cashback: 150, hot: false },
                { name: "Pulsa 25rb", category: "Pulsa", brand: "Kartu AS", capital: 24500, selling: 27000, cashback: 250, hot: true },
                { name: "Pulsa 50rb", category: "Pulsa", brand: "Kartu AS", capital: 48800, selling: 52000, cashback: 400, hot: false },
                { name: "Pulsa 100rb", category: "Pulsa", brand: "Kartu AS", capital: 97500, selling: 103000, cashback: 800, hot: false },
                // PULSA - byU
                { name: "Pulsa 10rb", category: "Pulsa", brand: "byU", capital: 9600, selling: 11000, cashback: 250, hot: true },
                { name: "Pulsa 20rb", category: "Pulsa", brand: "byU", capital: 19200, selling: 21500, cashback: 400, hot: false },
                { name: "Pulsa 50rb", category: "Pulsa", brand: "byU", capital: 48000, selling: 52000, cashback: 700, hot: true },
                // PAKET INTERNET - Simpati
                { name: "Internet 1GB/3 Hari", category: "Paket Internet", brand: "Simpati", capital: 8500, selling: 12000, cashback: 300, hot: false },
                { name: "Internet 2GB/7 Hari", category: "Paket Internet", brand: "Simpati", capital: 15000, selling: 20000, cashback: 500, hot: false },
                { name: "Internet 5GB/30 Hari", category: "Paket Internet", brand: "Simpati", capital: 28000, selling: 35000, cashback: 800, hot: true },
                { name: "Internet 10GB/30 Hari", category: "Paket Internet", brand: "Simpati", capital: 45000, selling: 55000, cashback: 1200, hot: true },
                { name: "Internet 15GB/30 Hari", category: "Paket Internet", brand: "Simpati", capital: 60000, selling: 75000, cashback: 1500, hot: true },
                { name: "Internet 25GB/30 Hari", category: "Paket Internet", brand: "Simpati", capital: 85000, selling: 100000, cashback: 2000, hot: false },
                { name: "Internet 50GB/30 Hari", category: "Paket Internet", brand: "Simpati", capital: 130000, selling: 155000, cashback: 3000, hot: false },
                // PAKET INTERNET - byU
                { name: "byU 1GB Harian", category: "Paket Internet", brand: "byU", capital: 5500, selling: 8000, cashback: 200, hot: false },
                { name: "byU 3GB/7 Hari", category: "Paket Internet", brand: "byU", capital: 12000, selling: 17000, cashback: 400, hot: true },
                { name: "byU 8GB/30 Hari", category: "Paket Internet", brand: "byU", capital: 35000, selling: 45000, cashback: 1000, hot: true },
                { name: "byU 15GB/30 Hari", category: "Paket Internet", brand: "byU", capital: 55000, selling: 70000, cashback: 1500, hot: false },
                { name: "byU 30GB/30 Hari", category: "Paket Internet", brand: "byU", capital: 90000, selling: 110000, cashback: 2500, hot: false },
                // PAKET INTERNET - Kartu AS
                { name: "Internet 2GB/7 Hari", category: "Paket Internet", brand: "Kartu AS", capital: 14500, selling: 19000, cashback: 400, hot: false },
                { name: "Internet 6GB/30 Hari", category: "Paket Internet", brand: "Kartu AS", capital: 32000, selling: 40000, cashback: 900, hot: true },
                { name: "Internet 12GB/30 Hari", category: "Paket Internet", brand: "Kartu AS", capital: 50000, selling: 62000, cashback: 1300, hot: false },
                // PAKET DIGITAL - e-Wallet
                { name: "Top Up OVO 25rb", category: "Paket Digital", brand: "e-Wallet", capital: 24500, selling: 26000, cashback: 200, hot: false },
                { name: "Top Up OVO 50rb", category: "Paket Digital", brand: "e-Wallet", capital: 49000, selling: 51500, cashback: 400, hot: true },
                { name: "Top Up OVO 100rb", category: "Paket Digital", brand: "e-Wallet", capital: 98000, selling: 102000, cashback: 700, hot: false },
                { name: "Top Up GoPay 25rb", category: "Paket Digital", brand: "e-Wallet", capital: 24800, selling: 26000, cashback: 150, hot: false },
                { name: "Top Up GoPay 50rb", category: "Paket Digital", brand: "e-Wallet", capital: 49200, selling: 51500, cashback: 350, hot: true },
                { name: "Top Up GoPay 100rb", category: "Paket Digital", brand: "e-Wallet", capital: 98500, selling: 102000, cashback: 600, hot: false },
                { name: "Top Up DANA 50rb", category: "Paket Digital", brand: "e-Wallet", capital: 49100, selling: 51500, cashback: 300, hot: false },
                { name: "Top Up DANA 100rb", category: "Paket Digital", brand: "e-Wallet", capital: 98200, selling: 102000, cashback: 650, hot: false },
                { name: "Top Up ShopeePay 50rb", category: "Paket Digital", brand: "e-Wallet", capital: 49300, selling: 51500, cashback: 250, hot: false },
                { name: "Top Up ShopeePay 100rb", category: "Paket Digital", brand: "e-Wallet", capital: 98400, selling: 102000, cashback: 500, hot: false },
                // PAKET DIGITAL - PPOB
                { name: "Token PLN 20rb", category: "Paket Digital", brand: "PPOB", capital: 19500, selling: 21000, cashback: 200, hot: true },
                { name: "Token PLN 50rb", category: "Paket Digital", brand: "PPOB", capital: 49000, selling: 51500, cashback: 500, hot: true },
                { name: "Token PLN 100rb", category: "Paket Digital", brand: "PPOB", capital: 98000, selling: 102000, cashback: 800, hot: false },
                { name: "BPJS Kesehatan", category: "Paket Digital", brand: "PPOB", capital: 0, selling: 2500, cashback: 500, hot: false },
                { name: "Tagihan Listrik", category: "Paket Digital", brand: "PPOB", capital: 0, selling: 3000, cashback: 600, hot: false },
                // PAKET ROAMING - Simpati
                { name: "Roaming ASEAN 3 Hari 1GB", category: "Paket Roaming", brand: "Simpati", capital: 75000, selling: 95000, cashback: 2000, hot: true },
                { name: "Roaming ASEAN 7 Hari 3GB", category: "Paket Roaming", brand: "Simpati", capital: 150000, selling: 185000, cashback: 4000, hot: false },
                { name: "Roaming Global 3 Hari 500MB", category: "Paket Roaming", brand: "Simpati", capital: 120000, selling: 150000, cashback: 3000, hot: false },
                { name: "Roaming Global 7 Hari 2GB", category: "Paket Roaming", brand: "Simpati", capital: 250000, selling: 300000, cashback: 5000, hot: false },
                // INJECT VOUCHER FISIK - Simpati
                { name: "Voucher Fisik 10rb", category: "Inject Voucher Fisik", brand: "Simpati", capital: 9200, selling: 10500, cashback: 200, hot: false },
                { name: "Voucher Fisik 25rb", category: "Inject Voucher Fisik", brand: "Simpati", capital: 23000, selling: 26000, cashback: 400, hot: true },
                { name: "Voucher Fisik 50rb", category: "Inject Voucher Fisik", brand: "Simpati", capital: 46000, selling: 52000, cashback: 800, hot: false },
                { name: "Voucher Fisik 100rb", category: "Inject Voucher Fisik", brand: "Simpati", capital: 92000, selling: 103000, cashback: 1500, hot: false },
                // INJECT VOUCHER FISIK - Kartu AS
                { name: "Voucher Fisik 10rb", category: "Inject Voucher Fisik", brand: "Kartu AS", capital: 9300, selling: 10500, cashback: 150, hot: false },
                { name: "Voucher Fisik 25rb", category: "Inject Voucher Fisik", brand: "Kartu AS", capital: 23200, selling: 26000, cashback: 350, hot: false },
                { name: "Voucher Fisik 50rb", category: "Inject Voucher Fisik", brand: "Kartu AS", capital: 46500, selling: 52000, cashback: 700, hot: false },
                // AKTIVASI PERDANA - Simpati
                { name: "Perdana Simpati 5GB", category: "Aktivasi Perdana", brand: "Simpati", capital: 15000, selling: 25000, cashback: 1500, hot: false },
                { name: "Perdana Simpati 10GB", category: "Aktivasi Perdana", brand: "Simpati", capital: 25000, selling: 40000, cashback: 2500, hot: true },
                { name: "Perdana Simpati 20GB", category: "Aktivasi Perdana", brand: "Simpati", capital: 40000, selling: 60000, cashback: 3000, hot: false },
                // AKTIVASI PERDANA - byU
                { name: "Perdana byU 6GB", category: "Aktivasi Perdana", brand: "byU", capital: 12000, selling: 20000, cashback: 1200, hot: false },
                { name: "Perdana byU 12GB", category: "Aktivasi Perdana", brand: "byU", capital: 20000, selling: 35000, cashback: 2000, hot: true },
                { name: "Perdana byU 25GB", category: "Aktivasi Perdana", brand: "byU", capital: 35000, selling: 55000, cashback: 3000, hot: false },
                // AKTIVASI PERDANA - Telkomsel Orbit
                { name: "Perdana Orbit 10GB", category: "Aktivasi Perdana", brand: "Telkomsel Orbit", capital: 30000, selling: 50000, cashback: 3000, hot: false },
                { name: "Perdana Orbit 25GB", category: "Aktivasi Perdana", brand: "Telkomsel Orbit", capital: 50000, selling: 80000, cashback: 5000, hot: true },
                { name: "Perdana Orbit 50GB", category: "Aktivasi Perdana", brand: "Telkomsel Orbit", capital: 80000, selling: 120000, cashback: 7000, hot: false },
            ];

            let cuanCount = 0;
            for (const p of cuanProductData) {
                await db.insert(cuanProducts).values({
                    id: uuid(),
                    name: p.name,
                    categoryId: cuanCategoryIds[p.category],
                    brandId: cuanBrandIds[p.brand],
                    capitalPrice: String(p.capital),
                    sellingPrice: String(p.selling),
                    cashback: String(p.cashback),
                    isActive: true,
                    isHot: p.hot,
                    createdAt: new Date(),
                });
                cuanCount++;
            }
            console.log(`  ✅ ${cuanCount} produk cuan ditambahkan`);
        }
    } catch (err) {
        console.log("⚠️ Failed to seed Kalkulator Cuan:", err);
    }

    console.log("\n🎉 Seed complete!");
    console.log("Admin login: admin@abkciraya.com / admin123\n");

    await connection.end();
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
});
