import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const params = await context.params;
        const id = params.id;

        const [product] = await db.select({
            id: products.id,
            name: products.name,
            type: products.type,
            description: products.description,
            imageUrl: products.imageUrl,
            price: products.price,
            stock: products.stock,
        })
            .from(products)
            .where(and(eq(products.id, id), eq(products.isActive, true)));

        if (!product) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(product);
    } catch (error) {
        console.error("Public Product GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
