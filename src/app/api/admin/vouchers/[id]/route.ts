import { NextResponse } from "next/server";
import { db } from "@/db";
import { vouchers, products } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const params = await context.params;
        const id = params.id;

        // get voucher first
        const [target] = await db.select().from(vouchers).where(eq(vouchers.id, id));
        if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

        await db.delete(vouchers).where(eq(vouchers.id, id));

        // update stock
        const productVouchers = await db.select({ count: sql<number>`count(*)` })
            .from(vouchers).where(sql`${vouchers.productId} = ${target.productId} AND ${vouchers.isUsed} = false`);

        await db.update(products).set({ stock: productVouchers[0].count }).where(eq(products.id, target.productId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Voucher DELETE error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
