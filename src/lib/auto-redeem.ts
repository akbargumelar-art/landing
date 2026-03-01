import { db } from "@/db";
import { orders, products, vouchers, redemptionLogs } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";

/**
 * Automates the redemption of a virtual product's voucher to the customer's phone.
 * @param orderId the ID of the confirmed paid order.
 */
export async function triggerAutoRedeem(orderId: string) {
    try {
        console.log(`[Auto-Redeem] Starting for Order ID: ${orderId}`);
        // 1. Fetch Order
        const [order] = await db.select({
            id: orders.id,
            productId: orders.productId,
            customerPhone: orders.customerPhone,
            paymentStatus: orders.paymentStatus,
        }).from(orders).where(eq(orders.id, orderId));

        if (!order) {
            console.error(`[Auto-Redeem] Event failed: Order not found.`);
            return false;
        }

        if (order.paymentStatus !== "success") {
            console.warn(`[Auto-Redeem] Event blocked: Payment is ${order.paymentStatus}`);
            return false;
        }

        // 2. Determine Product Type
        const [product] = await db.select().from(products).where(eq(products.id, order.productId));
        if (!product || product.type !== "virtual") {
            console.log(`[Auto-Redeem] Skipped. Product is not virtual.`);
            return false;
        }

        // 3. Find available unused voucher code
        const [voucher] = await db.select()
            .from(vouchers)
            .where(and(eq(vouchers.productId, product.id), eq(vouchers.isUsed, false)))
            .limit(1);

        if (!voucher) {
            console.error(`[Auto-Redeem] Event failed: NO VOUCHER STOCK for Product ID ${product.id}`);
            // Log the Failure
            await db.insert(redemptionLogs).values({
                id: uuid(),
                orderId: order.id,
                voucherId: "NO-STOCK",
                status: "gagal",
                responseMessage: "Stok voucher habis saat proses Auto-Redeem berjalan.",
                createdAt: new Date(),
            });
            return false;
        }

        // 4. Simulate Telkomsel Injection / Redemption (Puppeteer/API Hook goes here)
        console.log(`[Auto-Redeem] Executing Telkomsel Redemption Bot for +${order.customerPhone} (Voucher: ${voucher.code})`);

        // Simulating 5 seconds processing time
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 98% success rate simulation
        const isSuccess = Math.random() > 0.02;

        if (isSuccess) {
            console.log(`[Auto-Redeem] Telkomsel Injection SUCCESS`);

            // Log Success
            await db.insert(redemptionLogs).values({
                id: uuid(),
                orderId: order.id,
                voucherId: voucher.id,
                status: "sukses",
                responseMessage: "{\n  \"status\": 200,\n  \"message\": \"Redemtion successful\",\n  \"telkomselTrxId\": \"TRX-" + Date.now() + "\"\n}",
                createdAt: new Date(),
            });

            // Mark voucher as used
            await db.update(vouchers)
                .set({ isUsed: true, usedAt: new Date() })
                .where(eq(vouchers.id, voucher.id));

            // Reduce Product Stock correctly
            const productVouchers = await db.select({ count: sql<number>`count(*)` })
                .from(vouchers).where(sql`${vouchers.productId} = ${product.id} AND ${vouchers.isUsed} = false`);
            await db.update(products).set({ stock: productVouchers[0].count }).where(eq(products.id, product.id));

            return true;
        } else {
            console.error(`[Auto-Redeem] Telkomsel Injection FAILED (Network/Carrier Error)`);

            // Log Failure
            await db.insert(redemptionLogs).values({
                id: uuid(),
                orderId: order.id,
                voucherId: voucher.id,
                status: "gagal",
                responseMessage: "{\n  \"status\": 503,\n  \"message\": \"Vendor API Timeout or Incorrect Phone number\",\n  \"error_code\": \"TEL_TIMEOUT\"\n}",
                createdAt: new Date(),
            });

            return false;
        }

    } catch (e) {
        console.error(`[Auto-Redeem] CRITICAL EXCEPTION:`, e);
        return false;
    }
}
