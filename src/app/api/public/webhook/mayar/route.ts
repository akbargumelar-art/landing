import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { triggerAutoRedeem } from "@/lib/auto-redeem";

/**
 * Mayar.id Webhook Handler.
 *
 * Mayar sends a POST request to this endpoint when a payment event occurs.
 * The main event is `payment.received` which indicates a successful payment.
 *
 * Expected body structure:
 * {
 *   "event": "payment.received",
 *   "data": {
 *     "id": "...",
 *     "status": true,
 *     "amount": 50000,
 *     "customerName": "...",
 *     "customerEmail": "...",
 *     "customerMobile": "08123456789",
 *     ...
 *   }
 * }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();

        const event = body.event;
        const data = body.data;

        if (!event || !data) {
            console.warn("[Mayar Webhook] Missing event or data in body");
            return NextResponse.json(
                { error: "Missing event or data" },
                { status: 400 }
            );
        }

        // Only handle payment.received events
        if (event !== "payment.received") {
            console.log(`[Mayar Webhook] Ignoring event: ${event}`);
            return NextResponse.json({ success: true, ignored: true });
        }

        const invoiceId = data.id;
        if (!invoiceId) {
            console.warn("[Mayar Webhook] Missing data.id in body");
            return NextResponse.json(
                { error: "Missing invoice ID" },
                { status: 400 }
            );
        }

        // Find the order by Mayar invoice ID
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.invoiceNumber, invoiceId));

        if (!order) {
            console.warn(`[Mayar Webhook] Order not found for invoice: ${invoiceId}`);
            return NextResponse.json(
                { error: "Order not found" },
                { status: 404 }
            );
        }

        // Payment received = success
        if (data.status === true) {
            // Prevent duplicate processing
            if (order.paymentStatus !== "success") {
                await db
                    .update(orders)
                    .set({ paymentStatus: "success" })
                    .where(eq(orders.id, order.id));

                // Trigger Bot Auto-Redeem if product type is virtual
                triggerAutoRedeem(order.id).catch((err) =>
                    console.error("Auto-Redeem async error:", err)
                );
            }
        }

        return NextResponse.json({ success: true, received: true });
    } catch (error) {
        console.error("[Mayar Webhook] Error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
