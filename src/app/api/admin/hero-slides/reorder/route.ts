import { NextResponse } from "next/server";
import { db } from "@/db";
import { heroSlides } from "@/db/schema";
import { eq } from "drizzle-orm";

// PUT reorder hero slides
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { order } = body; // array of { id, sortOrder }

        for (const item of order) {
            await db
                .update(heroSlides)
                .set({ sortOrder: item.sortOrder })
                .where(eq(heroSlides.id, item.id));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Reorder error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
