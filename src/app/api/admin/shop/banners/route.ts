import { NextResponse } from "next/server";
import { db } from "@/db";
import { shopBanners } from "@/db/schema";
import { asc, max } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function GET() {
    try {
        const all = await db.select().from(shopBanners).orderBy(asc(shopBanners.sortOrder));
        return NextResponse.json(all);
    } catch (error) {
        console.error("Shop banners GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const [{ maxOrder }] = await db.select({ maxOrder: max(shopBanners.sortOrder) }).from(shopBanners);
        const newId = uuid();
        await db.insert(shopBanners).values({
            id: newId,
            title: body.title || "",
            imageUrl: body.imageUrl || "",
            link: body.link || "",
            sortOrder: (maxOrder || 0) + 1,
            isActive: body.isActive ?? true,
            createdAt: new Date(),
        });
        const result = await db.query.shopBanners.findFirst({ where: (b, { eq }) => eq(b.id, newId) });
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        console.error("Shop banners POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
