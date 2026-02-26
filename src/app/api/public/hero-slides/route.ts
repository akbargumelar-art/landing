import { NextResponse } from "next/server";
import { db } from "@/db";
import { heroSlides } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
    try {
        const slides = await db
            .select()
            .from(heroSlides)
            .where(eq(heroSlides.isActive, true))
            .orderBy(asc(heroSlides.sortOrder));
        return NextResponse.json(slides);
    } catch (error) {
        console.error("Public hero slides error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
