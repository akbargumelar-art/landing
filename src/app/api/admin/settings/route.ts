import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// GET all settings
export async function GET() {
    try {
        const settings = await db.select().from(siteSettings);
        const settingsMap: Record<string, string> = {};
        for (const s of settings) {
            settingsMap[s.key] = s.value;
        }
        return NextResponse.json(settingsMap);
    } catch (error) {
        console.error("Settings GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PUT update settings
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const updates: { key: string; value: string; type?: string }[] = body.settings;

        for (const update of updates) {
            const existing = await db
                .select()
                .from(siteSettings)
                .where(eq(siteSettings.key, update.key))
                .limit(1);

            if (existing.length > 0) {
                await db
                    .update(siteSettings)
                    .set({ value: update.value })
                    .where(eq(siteSettings.key, update.key));
            } else {
                await db.insert(siteSettings).values({
                    id: uuid(),
                    key: update.key,
                    value: update.value,
                    type: update.type || "text",
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Settings PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
