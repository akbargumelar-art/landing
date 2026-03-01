import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, products, redemptionLogs } from "@/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limitStr = searchParams.get("limit") || "100";
        const offsetStr = searchParams.get("offset") || "0";

        const limit = parseInt(limitStr, 10);
        const offset = parseInt(offsetStr, 10);

        // Fetch paginated orders with their corresponding products
        const allOrders = await db.select({
            id: orders.id,
            customerPhone: orders.customerPhone,
            paymentStatus: orders.paymentStatus,
            totalPrice: orders.totalPrice,
            lynkIdUrl: orders.lynkIdUrl,
            lynkIdTrx: orders.lynkIdTrx,
            createdAt: orders.createdAt,
            productId: products.id,
            productName: products.name,
            productType: products.type,
        })
            .from(orders)
            .leftJoin(products, eq(orders.productId, products.id))
            .orderBy(desc(orders.createdAt))
            .limit(limit)
            .offset(offset);

        // For each order, find if there's a redemption log (for virtual products)
        const orderIds = allOrders.map(o => o.id);

        let logsMap: Record<string, any> = {};
        if (orderIds.length > 0) {
            const logs = await db.select()
                .from(redemptionLogs)
                .where(sql`${redemptionLogs.orderId} IN (${orderIds.map(i => `'${i}'`).join(",")})`);

            for (const lg of logs) {
                logsMap[lg.orderId] = lg;
            }
        }

        const result = allOrders.map(o => ({
            ...o,
            // If logsMap stores arrays, we might want to return the first log or the whole array.
            // Sticking to the original behavior of returning a single log or null,
            // we'll take the first element if an array exists, otherwise null.
            redemptionLog: logsMap[o.id] ? logsMap[o.id][0] : null,
        }));

        const totalCountParams = await db.select({ value: count() }).from(orders);
        const totalCount = totalCountParams[0].value;

        return NextResponse.json({
            data: result,
            meta: {
                totalCount,
                limit,
                offset,
            }
        });
    } catch (error) {
        console.error("Orders GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
