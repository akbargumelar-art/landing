import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId, customerPhone } = body;

        if (!productId || !customerPhone) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Clean phone number (remove non-digits, replace starting 0 with 62 is optional for Lynk, but good for WA)
        const cleanPhone = customerPhone.replace(/\D/g, '');

        // Check product exists and has stock
        const [product] = await db.select().from(products).where(eq(products.id, productId));
        if (!product || !product.isActive) {
            return NextResponse.json({ error: "Product not available" }, { status: 404 });
        }
        if (product.stock <= 0) {
            return NextResponse.json({ error: "Out of stock" }, { status: 400 });
        }

        const newOrderId = uuid();

        // ==============================================================================
        // MOCK LYNK.ID INTEGRATION (To be replaced with actual HTTP request to Lynk.id)
        // ==============================================================================
        // TODO: The user needs to provide Lynk.id API Keys and Secret.
        // For now, we will simulate a successful invoice creation.
        const mockLynkIdTrx = `LYNK-${Date.now()}`;
        // Since we don't have the real URL, we'll direct them to our own waiting page for testing
        // or a simulated payment gateway. 
        // We will just redirect them to our checkout status page where they can "simulasikan bayar".
        const mockLynkIdUrl = `/checkout/simulate?orderId=${newOrderId}&amount=${product.price}`;

        // Insert Order
        await db.insert(orders).values({
            id: newOrderId,
            productId: product.id,
            customerPhone: cleanPhone,
            totalPrice: product.price,
            paymentStatus: "pending",
            lynkIdTrx: mockLynkIdTrx,
            lynkIdUrl: mockLynkIdUrl,
            createdAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            orderId: newOrderId,
            paymentUrl: mockLynkIdUrl
        });

    } catch (error) {
        console.error("Public Order POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
