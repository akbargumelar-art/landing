import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, orders, siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { createMayarInvoice } from "@/lib/mayar";
import { createMidtransTransaction } from "@/lib/midtrans";

/**
 * Get the currently active payment gateway from site_settings.
 * Defaults to "mayar" if not configured.
 */
async function getActiveGateway(): Promise<"mayar" | "midtrans"> {
    const [setting] = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, "payment_gateway_active"));
    const value = setting?.value;
    if (value === "midtrans") return "midtrans";
    return "mayar";
}

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
        const gateway = await getActiveGateway();

        let paymentUrl: string;
        let invoiceId: string;

        if (gateway === "midtrans") {
            // ==============================================================================
            // Midtrans Snap Payment Gateway Integration
            // ==============================================================================
            const midtransResult = await createMidtransTransaction({
                orderId: newOrderId,
                amount: Number(product.price),
                customerPhone: cleanPhone,
                productName: product.name,
            });

            if (!midtransResult.success) {
                console.error("Midtrans transaction creation failed:", midtransResult.error);
                return NextResponse.json(
                    { error: `Gagal membuat transaksi pembayaran: ${midtransResult.error}` },
                    { status: 502 }
                );
            }

            paymentUrl = midtransResult.paymentUrl;
            invoiceId = newOrderId; // Midtrans uses order_id as the identifier
        } else {
            // ==============================================================================
            // Mayar.id Payment Gateway Integration (default)
            // ==============================================================================
            const mayarResult = await createMayarInvoice({
                orderId: newOrderId,
                amount: Number(product.price),
                customerPhone: cleanPhone,
                productName: product.name,
            });

            if (!mayarResult.success) {
                console.error("Mayar invoice creation failed:", mayarResult.error);
                return NextResponse.json(
                    { error: `Gagal membuat invoice pembayaran: ${mayarResult.error}` },
                    { status: 502 }
                );
            }

            paymentUrl = mayarResult.paymentUrl;
            invoiceId = mayarResult.invoiceId;
        }

        // Insert Order
        await db.insert(orders).values({
            id: newOrderId,
            productId: product.id,
            customerPhone: cleanPhone,
            paymentGateway: gateway,
            totalPrice: product.price,
            paymentStatus: "pending",
            invoiceNumber: invoiceId,
            paymentUrl: paymentUrl,
            createdAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            orderId: newOrderId,
            paymentUrl: paymentUrl,
        });

    } catch (error) {
        console.error("Public Order POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
