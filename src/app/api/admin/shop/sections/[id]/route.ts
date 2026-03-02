import { NextResponse } from "next/server";
import { db } from "@/db";
import { shopSections } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const params = await context.params;
        const id = params.id;
        const body = await request.json();
        await db.update(shopSections).set({
            type: body.type,
            title: body.title,
            subtitle: body.subtitle,
            config: body.config,
            sortOrder: body.sortOrder,
            isActive: body.isActive,
        }).where(eq(shopSections.id, id));
        const updated = await db.query.shopSections.findFirst({ where: (s, { eq: e }) => e(s.id, id) });
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Shop section PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const params = await context.params;
        const id = params.id;
        await db.delete(shopSections).where(eq(shopSections.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Shop section DELETE error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
