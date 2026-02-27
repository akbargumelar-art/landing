import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { siteSettings, heroSlides, programs, user, account } from "./schema";
import { v4 as uuid } from "uuid";
import { scryptSync, randomBytes } from "crypto";
import { programs as mockPrograms, heroSlides as mockSlides } from "../lib/mock-data";

function hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    return `${salt}:${derivedKey.toString("hex")}`;
}

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
        await db.delete(heroSlides); // clear existing first
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
    try {
        // We do not delete programs automatically to avoid dropping user data,
        // but we'll insert them if the table is empty.
        const existingPrograms = await db.select().from(programs).limit(1);
        if (existingPrograms.length === 0) {
            const formattedPrograms = mockPrograms.map((prog, index) => ({
                id: prog.id, // using original id to maintain relations if needed later
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
            console.log("✅ Programs imported from mock data");
        } else {
            console.log("⚠️ Programs table already contains data, skipping mock import.");
        }
    } catch (err) {
        console.log("⚠️ Failed to import programs:", err);
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
