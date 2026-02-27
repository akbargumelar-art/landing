import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { siteSettings, heroSlides, user, account } from "./schema";
import { v4 as uuid } from "uuid";
import { scryptSync, randomBytes } from "crypto";

function hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 16, p: 1 });
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

    // 3. Default hero slide
    console.log("Creating hero slide...");
    try {
        await db.insert(heroSlides).values({
            id: uuid(),
            title: "Selamat Datang di ABK Ciraya",
            subtitle: "Program undian dan hadiah terbaik untuk mitra dan pelanggan setia",
            ctaText: "Lihat Program",
            ctaLink: "/program",
            bgColor: "from-red-600 via-red-500 to-orange-500",
            sortOrder: 0,
            isActive: true,
            createdAt: new Date(),
        });
        console.log("✅ Hero slide created");
    } catch {
        console.log("⚠️ Hero slide may already exist");
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
