import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { triggerAutoRedeem } from "@/lib/auto-redeem";
import { getDokuConfig, verifyNotificationSignature } from "@/lib/doku";

/**
 * DOKU HTTP Notification (Webhook) Handler.
 *
 * DOKU sends a POST request to this endpoint when a payment status changes.
 * The notification includes headers for signature verification and a JSON body
 * with the transaction details.
 *
 * Expected body structure:
 * {
 *   "order": { "invoice_number": "INV-...", "amount": 50000 },
 *   "transaction": { "status": "SUCCESS" | "FAILED" | "EXPIRED", ... },
 *   ...
 * }
 */
export async function POST(request: Request) {
    try {
        const payload = await request.text();
        const headers = request.headers;

        // Extract DOKU headers
        const requestId = headers.get("Request-Id") || "";
        const timestamp = headers.get("Request-Timestamp") || "";
        const receivedSignature = headers.get("Signature") || "";

        // Get DOKU config for verification
        const config = await getDokuConfig();

        // Verify signature if config is available
        if (config) {
            const digest = crypto
                .createHash("sha256")
                .update(payload, "utf8")
                .digest("base64");

            const requestTarget = "/api/public/webhook/doku";

            const isValid = verifyNotificationSignature(
                config.clientId,
                config.secretKey,
                requestId,
                timestamp,
                requestTarget,
                digest,
                receivedSignature
            );

            if (!isValid) {
                console.warn("[DOKU Webhook] Invalid signature. Rejecting.");
                return NextResponse.json(
                    { error: "Invalid signature" },
                    { status: 401 }
                );
            }
        }

        const body = JSON.parse(payload);

        // Parse DOKU notification body
        const invoiceNumber = body.order?.invoice_number;
        const transactionStatus = body.transaction?.status; // "SUCCESS", "FAILED", "EXPIRED"

        if (!invoiceNumber) {
            console.warn("[DOKU Webhook] Missing invoice_number in body");
            return NextResponse.json(
                { error: "Missing invoice_number" },
                { status: 400 }
            );
        }

        // Find the order by DOKU invoice number
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.dokuInvoiceNumber, invoiceNumber));

        if (!order) {
            console.warn(`[DOKU Webhook] Order not found for invoice: ${invoiceNumber}`);
            return NextResponse.json(
                { error: "Order not found" },
                { status: 404 }
            );
        }

        if (transactionStatus === "SUCCESS") {
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
        } else if (
            transactionStatus === "FAILED" ||
            transactionStatus === "EXPIRED"
        ) {
            await db
                .update(orders)
                .set({ paymentStatus: "failed" })
                .where(eq(orders.id, order.id));
        }

        return NextResponse.json({ success: true, received: true });
    } catch (error) {
        console.error("[DOKU Webhook] Error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
