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

    console.log("\n🎉 Seed complete!");
    console.log("Admin login: admin@abkciraya.com / admin123\n");

    await connection.end();
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
});
