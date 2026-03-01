import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { triggerAutoRedeem } from "@/lib/auto-redeem";
// import crypto from "crypto";

export async function POST(request: Request) {
    try {
        const payload = await request.text();
        // const headers = request.headers;

        // TODO: Validate Lynk.id signature
        // const signature = headers.get("x-lynkid-signature");
        // const expectedSignature = crypto.createHmac("sha256", process.env.LYNKID_WEBHOOK_SECRET!).update(payload).digest("hex");
        // if (signature !== expectedSignature) return NextResponse.json({ error: "Invalid sig" }, { status: 401 });

        const body = JSON.parse(payload);

        // Assuming body structure from Lynk.id
        // e.g., { trx_id: "...", status: "success", external_id: "order-id" }
        const status = body.status;
        const orderId = body.external_id;

        if (status === "success" && orderId) {
            // Check current status to prevent duplicate processing
            const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

            if (order && order.paymentStatus !== "success") {
                await db.update(orders).set({ paymentStatus: "success" }).where(eq(orders.id, orderId));

                // Trigger Bot Auto-Redeem if product type is virtual
                triggerAutoRedeem(orderId).catch(err => console.error("Auto-Redeem async error:", err));
            }
        } else if (status === "failed" || status === "expired") {
            await db.update(orders).set({ paymentStatus: "failed" }).where(eq(orders.id, orderId));
        }

        return NextResponse.json({ success: true, received: true });

    } catch (error) {
        console.error("Lynk.id Webhook Error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
