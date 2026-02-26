import { NextResponse } from "next/server";
import { db } from "@/db";
import { heroSlides } from "@/db/schema";
import { asc, eq, max } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// GET all hero slides
export async function GET() {
    try {
        const slides = await db
            .select()
            .from(heroSlides)
            .orderBy(asc(heroSlides.sortOrder));
        return NextResponse.json(slides);
    } catch (error) {
        console.error("Hero slides GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST create new hero slide
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const [maxResult] = await db
            .select({ maxOrder: max(heroSlides.sortOrder) })
            .from(heroSlides);
        const newOrder = (maxResult?.maxOrder ?? -1) + 1;

        const newId = uuid();
        await db.insert(heroSlides).values({
            id: newId,
            title: body.title || "",
            subtitle: body.subtitle || "",
            ctaText: body.ctaText || "",
            ctaLink: body.ctaLink || "",
            imageUrl: body.imageUrl || "",
            bgColor: body.bgColor || "from-red-600 via-red-500 to-red-700",
            sortOrder: newOrder,
            isActive: body.isActive ?? true,
            createdAt: new Date(),
        });

        const [slide] = await db
            .select()
            .from(heroSlides)
            .where(eq(heroSlides.id, newId));
        return NextResponse.json(slide, { status: 201 });
    } catch (error) {
        console.error("Hero slide POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
