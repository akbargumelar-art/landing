import { NextResponse } from "next/server";
import { db } from "@/db";
import { vouchers, products } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');

        let query = db.select({
            id: vouchers.id,
            code: vouchers.code,
            isUsed: vouchers.isUsed,
            createdAt: vouchers.createdAt,
            usedAt: vouchers.usedAt,
            productName: products.name,
        }).from(vouchers)
            .leftJoin(products, eq(vouchers.productId, products.id))
            .orderBy(desc(vouchers.createdAt));

        if (productId) {
            query = query.where(eq(vouchers.productId, productId)) as any;
        }

        // Limit to 500 so we don't crash the browser if there are thousands
        const allVouchers = await query.limit(500);
        return NextResponse.json(allVouchers);
    } catch (error) {
        console.error("Vouchers GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId, codes } = body;

        if (!productId || !codes || !Array.isArray(codes)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const values = body.codes.map((code: any) => ({
            id: uuid(),
            productId,
            code: code.trim(),
            isUsed: false,
            createdAt: new Date(),
        }));

        if (values.length === 0) {
            return NextResponse.json({ success: true, inserted: 0 });
        }

        // Batch insert ignore conflicts (just in case duplicates exist)
        // Drizzle mysql doesn't natively support ON DUPLICATE KEY UPDATE easily in bulk without raw sql, 
        // so we'll do standard insert and catch errors, or use insert().onDuplicateKeyUpdate

        // Since we are doing a simple script, let's just insert all and if one fails, maybe it fails all.
        // Actually to be safe, we will just insert them:
        await db.insert(vouchers).values(values).onDuplicateKeyUpdate({ set: { id: sql`id` } });

        // Update product stock count
        const productVouchers = await db.select({ count: sql<number>`count(*)` })
            .from(vouchers).where(sql`${vouchers.productId} = ${productId} AND ${vouchers.isUsed} = false`);

        await db.update(products).set({ stock: productVouchers[0].count }).where(eq(products.id, productId));

        return NextResponse.json({ success: true, inserted: values.length });
    } catch (error) {
        console.error("Vouchers POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
