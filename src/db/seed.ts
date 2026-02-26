import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { siteSettings, heroSlides } from "./schema";
import { v4 as uuid } from "uuid";

async function seed() {
    const connection = await mysql.createConnection(
        process.env.DATABASE_URL || "mysql://root:@localhost:3306/abk_ciraya"
    );
    const db = drizzle({ client: connection });

    console.log("🌱 Seeding database...");

    // 1. Create admin user via better-auth API
    console.log("Creating admin user...");
    try {
        const res = await fetch(`${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/api/auth/sign-up/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Admin",
                email: "admin@abkciraya.com",
                password: "admin123",
            }),
        });
        if (res.ok) {
            console.log("✅ Admin user created: admin@abkciraya.com / admin123");
        } else {
            const t = await res.text();
            console.log("⚠️ Admin user may already exist:", t);
        }
    } catch {
        console.log("⚠️ Could not create admin user via API (server may not be running). Create manually.");
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
