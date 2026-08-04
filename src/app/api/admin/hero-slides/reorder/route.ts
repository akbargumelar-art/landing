import { NextResponse } from "next/server";
import { db } from "@/db";
import { heroSlides } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/admin-auth";

// PUT reorder hero slides
export async function PUT(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

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
