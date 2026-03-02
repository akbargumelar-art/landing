import { NextResponse } from "next/server";
import { db } from "@/db";
import { shopSections } from "@/db/schema";
import { asc, max } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function GET() {
    try {
        const all = await db.select().from(shopSections).orderBy(asc(shopSections.sortOrder));
        return NextResponse.json(all);
    } catch (error) {
        console.error("Shop sections GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const [{ maxOrder }] = await db.select({ maxOrder: max(shopSections.sortOrder) }).from(shopSections);
        const newId = uuid();
        await db.insert(shopSections).values({
            id: newId,
            type: body.type || "product_carousel",
            title: body.title || "",
            subtitle: body.subtitle || "",
            config: body.config || "{}",
            sortOrder: (maxOrder || 0) + 1,
            isActive: body.isActive ?? true,
            createdAt: new Date(),
        });
        const result = await db.query.shopSections.findFirst({ where: (s, { eq }) => eq(s.id, newId) });
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        console.error("Shop sections POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
