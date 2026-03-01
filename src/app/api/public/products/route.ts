import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
    try {
        const publicProducts = await db.select({
            id: products.id,
            name: products.name,
            type: products.type,
            description: products.description,
            imageUrl: products.imageUrl,
            price: products.price,
            stock: products.stock,
        })
            .from(products)
            .where(eq(products.isActive, true));

        return NextResponse.json(publicProducts);
    } catch (error) {
        console.error("Public Products GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
