import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { triggerAutoRedeem } from "@/lib/auto-redeem";

// TEMPORARY ENDPOINT FOR TESTING WITHOUT REAL LYNK.ID
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const params = await context.params;
        const id = params.id;

        const [order] = await db.select().from(orders).where(eq(orders.id, id));
        if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

        if (order.paymentStatus === "success") {
            return NextResponse.json({ success: true, message: "Already paid" });
        }

        await db.update(orders).set({ paymentStatus: "success" }).where(eq(orders.id, id));

        // Trigger bot asynchronously for testing the Auto-Redeem flow
        triggerAutoRedeem(id).catch(err => console.error("Auto-Redeem async error:", err));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Simulate Payment error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
