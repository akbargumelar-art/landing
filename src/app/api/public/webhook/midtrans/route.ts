import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { triggerAutoRedeem } from "@/lib/auto-redeem";
import { getMidtransConfig, verifyMidtransSignature } from "@/lib/midtrans";

/**
 * Midtrans Webhook (HTTP Notification) Handler.
 *
 * Midtrans sends a POST request to this endpoint when a payment status changes.
 * Expected body structure:
 * {
 *   "transaction_status": "settlement" | "capture" | "pending" | "deny" | "expire" | "cancel",
 *   "order_id": "...",
 *   "status_code": "200",
 *   "gross_amount": "50000.00",
 *   "signature_key": "...",
 *   "payment_type": "...",
 *   "fraud_status": "accept" | "challenge" | "deny",
 *   ...
 * }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            transaction_status,
            order_id,
            status_code,
            gross_amount,
            signature_key,
            fraud_status,
        } = body;

        console.log(`[Midtrans Webhook] Received: status=${transaction_status}, order=${order_id}`);

        if (!order_id || !transaction_status) {
            console.warn("[Midtrans Webhook] Missing order_id or transaction_status");
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Verify signature
        const config = await getMidtransConfig();
        if (config && signature_key) {
            const isValid = verifyMidtransSignature(
                order_id,
                status_code,
                gross_amount,
                config.serverKey,
                signature_key
            );
            if (!isValid) {
                console.error("[Midtrans Webhook] Invalid signature for order:", order_id);
                return NextResponse.json(
                    { error: "Invalid signature" },
                    { status: 403 }
                );
            }
        }

        // Find the order
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, order_id));

        if (!order) {
            console.warn(`[Midtrans Webhook] Order not found: ${order_id}`);
            return NextResponse.json(
                { error: "Order not found" },
                { status: 404 }
            );
        }

        // Determine new payment status based on transaction_status
        // https://docs.midtrans.com/docs/https-notification-webhooks
        let newPaymentStatus: "success" | "failed" | null = null;

        if (transaction_status === "capture") {
            // For credit card: check fraud_status
            newPaymentStatus = fraud_status === "accept" ? "success" : null;
        } else if (transaction_status === "settlement") {
            newPaymentStatus = "success";
        } else if (
            transaction_status === "deny" ||
            transaction_status === "cancel" ||
            transaction_status === "expire"
        ) {
            newPaymentStatus = "failed";
        }
        // "pending" → no update needed

        if (newPaymentStatus && order.paymentStatus !== newPaymentStatus) {
            await db
                .update(orders)
                .set({ paymentStatus: newPaymentStatus })
                .where(eq(orders.id, order.id));

            console.log(`[Midtrans Webhook] Updated order ${order.id} to ${newPaymentStatus}`);

            // Trigger auto-redeem for virtual products on success
            if (newPaymentStatus === "success") {
                triggerAutoRedeem(order.id).catch((err) =>
                    console.error("Auto-Redeem async error:", err)
                );
            }
        }

        return NextResponse.json({ success: true, received: true });
    } catch (error) {
        console.error("[Midtrans Webhook] Error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
