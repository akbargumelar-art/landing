import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { createDokuPayment } from "@/lib/doku";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId, customerPhone } = body;

        if (!productId || !customerPhone) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Clean phone number (remove non-digits)
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
        // DOKU Payment Gateway Integration
        // ==============================================================================
        const dokuResult = await createDokuPayment({
            orderId: newOrderId,
            amount: Number(product.price),
            customerPhone: cleanPhone,
            productName: product.name,
        });

        // Insert Order
        await db.insert(orders).values({
            id: newOrderId,
            productId: product.id,
            customerPhone: cleanPhone,
            totalPrice: product.price,
            paymentStatus: "pending",
            dokuInvoiceNumber: dokuResult.invoiceNumber,
            dokuPaymentUrl: dokuResult.paymentUrl,
            createdAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            orderId: newOrderId,
            paymentUrl: dokuResult.paymentUrl,
        });

    } catch (error) {
        console.error("Public Order POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
