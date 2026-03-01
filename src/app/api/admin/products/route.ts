import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { v4 as uuid } from "uuid";

export async function GET() {
    try {
        const allProducts = await db.select().from(products);
        return NextResponse.json(allProducts);
    } catch (error) {
        console.error("Products GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newId = uuid();

        await db.insert(products).values({
            id: newId,
            name: body.name,
            type: body.type || "fisik",
            description: body.description || "",
            imageUrl: body.imageUrl || "",
            price: body.price || "0.00",
            stock: body.stock || 0,
            isActive: body.isActive ?? true,
            createdAt: new Date(),
        });

        const newProduct = await db.query.products.findFirst({
            where: (products, { eq }) => eq(products.id, newId)
        });

        return NextResponse.json(newProduct, { status: 201 });
    } catch (error) {
        console.error("Products POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
