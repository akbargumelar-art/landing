import { NextResponse } from "next/server";
import { db } from "@/db";
import { shopBanners } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const params = await context.params;
        const id = params.id;
        const body = await request.json();
        await db.update(shopBanners).set({
            title: body.title,
            imageUrl: body.imageUrl,
            link: body.link,
            sortOrder: body.sortOrder,
            isActive: body.isActive,
        }).where(eq(shopBanners.id, id));
        const updated = await db.query.shopBanners.findFirst({ where: (b, { eq: e }) => e(b.id, id) });
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Shop banner PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const params = await context.params;
        const id = params.id;
        await db.delete(shopBanners).where(eq(shopBanners.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Shop banner DELETE error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
