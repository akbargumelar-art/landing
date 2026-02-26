import { NextResponse } from "next/server";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";

export async function GET() {
    try {
        const settings = await db.select().from(siteSettings);
        const map: Record<string, string> = {};
        for (const s of settings) {
            map[s.key] = s.value;
        }
        return NextResponse.json(map);
    } catch (error) {
        console.error("Public settings error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
