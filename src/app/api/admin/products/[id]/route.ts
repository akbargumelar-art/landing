import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const params = await context.params;
        const id = params.id;
        const body = await request.json();

        await db.update(products).set({
            name: body.name,
            type: body.type,
            description: body.description,
            imageUrl: body.imageUrl,
            price: body.price,
            stock: body.stock,
            isActive: body.isActive,
        }).where(eq(products.id, id));

        const updated = await db.query.products.findFirst({
            where: (products, { eq }) => eq(products.id, id)
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Product PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const params = await context.params;
        const id = params.id;
        await db.delete(products).where(eq(products.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Product DELETE error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
