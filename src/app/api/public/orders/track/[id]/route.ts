import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, products } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const params = await context.params;
        const id = params.id;

        const [order] = await db.select({
            id: orders.id,
            customerPhone: orders.customerPhone,
            paymentStatus: orders.paymentStatus,
            totalPrice: orders.totalPrice,
            lynkIdUrl: orders.lynkIdUrl,
            createdAt: orders.createdAt,
            product: {
                name: products.name,
                type: products.type
            }
        })
            .from(orders)
            .leftJoin(products, eq(orders.productId, products.id))
            .where(eq(orders.id, id));

        if (!order) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (error) {
        console.error("Tracking GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
