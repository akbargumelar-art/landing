import { db } from "@/db";
import { orders, products, vouchers, redemptionLogs } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";

/** Berapa kali klaim voucher dicoba ulang saat kalah balapan dengan redeem lain. */
const MAX_PERCOBAAN_KLAIM = 5;

/**
 * Mengklaim satu voucher yang belum terpakai secara atomik.
 *
 * Sebelumnya pemilihan voucher hanya `SELECT ... WHERE is_used = false LIMIT 1`, dan
 * penandaan `is_used` baru terjadi setelah proses redeem yang panjang selesai. Terbukti
 * di uji runtime 2026-08-06: tiga redeem yang tumpang tindih memilih voucher yang SAMA
 * dan ketiga pelanggan menerima kode yang identik, sementara stok hanya berkurang satu.
 *
 * Pola di sini compare-and-swap: baris ditandai terpakai lebih dulu, dengan `is_used = false`
 * ikut sebagai syarat WHERE. Hanya satu pemanggil yang bisa mendapat `affectedRows = 1`
 * untuk baris yang sama; yang kalah mengambil kandidat berikutnya.
 */
async function klaimVoucher(productId: string) {
    for (let percobaan = 0; percobaan < MAX_PERCOBAAN_KLAIM; percobaan++) {
        const [kandidat] = await db
            .select()
            .from(vouchers)
            .where(and(eq(vouchers.productId, productId), eq(vouchers.isUsed, false)))
            .limit(1);

        if (!kandidat) return null;

        const hasil = await db
            .update(vouchers)
            .set({ isUsed: true, usedAt: new Date() })
            .where(and(eq(vouchers.id, kandidat.id), eq(vouchers.isUsed, false)));

        if (hasil[0].affectedRows > 0) return kandidat;

        console.warn(
            `[Auto-Redeem] Voucher ${kandidat.id} sudah diklaim proses lain, mencoba kandidat berikutnya.`
        );
    }

    console.error(`[Auto-Redeem] Gagal mengklaim voucher setelah ${MAX_PERCOBAAN_KLAIM} percobaan.`);
    return null;
}

/** Mengembalikan voucher ke stok bila proses redeem gagal setelah voucher diklaim. */
async function lepasVoucher(voucherId: string) {
    await db
        .update(vouchers)
        .set({ isUsed: false, usedAt: null })
        .where(eq(vouchers.id, voucherId));
}

/** Menyelaraskan stok produk dengan jumlah voucher yang belum terpakai. */
async function segarkanStok(productId: string) {
    const [hitung] = await db
        .select({ count: sql<number>`count(*)` })
        .from(vouchers)
        .where(and(eq(vouchers.productId, productId), eq(vouchers.isUsed, false)));

    await db.update(products).set({ stock: hitung.count }).where(eq(products.id, productId));
}

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

        // 2. Idempotensi. Webhook pembayaran bisa dikirim ulang oleh gateway, dan tanpa
        // penjagaan ini setiap pengiriman ulang akan menghabiskan satu voucher lagi untuk
        // order yang sama.
        const [sudahSukses] = await db
            .select({ id: redemptionLogs.id })
            .from(redemptionLogs)
            .where(and(eq(redemptionLogs.orderId, orderId), eq(redemptionLogs.status, "sukses")))
            .limit(1);

        if (sudahSukses) {
            console.log(`[Auto-Redeem] Order ${orderId} sudah pernah berhasil di-redeem. Dilewati.`);
            return true;
        }

        // 3. Determine Product Type
        const [product] = await db.select().from(products).where(eq(products.id, order.productId));
        if (!product || product.type !== "virtual") {
            console.log(`[Auto-Redeem] Skipped. Product is not virtual.`);
            return false;
        }

        // 4. Klaim voucher secara atomik SEBELUM proses panjang dimulai.
        const voucher = await klaimVoucher(product.id);

        if (!voucher) {
            console.error(`[Auto-Redeem] Event failed: NO VOUCHER STOCK for Product ID ${product.id}`);
            // `voucher_id` dibiarkan null. Sebelumnya diisi string "NO-STOCK" yang melanggar
            // foreign key ke `vouchers.id`, sehingga insert ini melempar dan kegagalan stok
            // habis tidak pernah benar-benar tercatat (terbukti di uji runtime 2026-08-06).
            await db.insert(redemptionLogs).values({
                id: uuid(),
                orderId: order.id,
                voucherId: null,
                status: "gagal",
                responseMessage: "Stok voucher habis saat proses Auto-Redeem berjalan.",
                createdAt: new Date(),
            });
            await segarkanStok(product.id);
            return false;
        }

        // 5. Simulate Telkomsel Injection / Redemption (Puppeteer/API Hook goes here)
        console.log(`[Auto-Redeem] Executing Telkomsel Redemption Bot for +${order.customerPhone} (Voucher: ${voucher.code})`);

        // Simulating 5 seconds processing time
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 98% success rate simulation
        const isSuccess = Math.random() > 0.02;

        if (isSuccess) {
            console.log(`[Auto-Redeem] Telkomsel Injection SUCCESS`);

            // Log Success. Voucher sudah ditandai terpakai saat diklaim di langkah 4.
            await db.insert(redemptionLogs).values({
                id: uuid(),
                orderId: order.id,
                voucherId: voucher.id,
                status: "sukses",
                responseMessage: "{\n  \"status\": 200,\n  \"message\": \"Redemtion successful\",\n  \"telkomselTrxId\": \"TRX-" + Date.now() + "\"\n}",
                createdAt: new Date(),
            });

            await segarkanStok(product.id);

            return true;
        } else {
            console.error(`[Auto-Redeem] Telkomsel Injection FAILED (Network/Carrier Error)`);

            // Redeem gagal, jadi voucher dikembalikan ke stok supaya kodenya tidak hangus.
            await lepasVoucher(voucher.id);

            // Log Failure
            await db.insert(redemptionLogs).values({
                id: uuid(),
                orderId: order.id,
                voucherId: voucher.id,
                status: "gagal",
                responseMessage: "{\n  \"status\": 503,\n  \"message\": \"Vendor API Timeout or Incorrect Phone number\",\n  \"error_code\": \"TEL_TIMEOUT\"\n}",
                createdAt: new Date(),
            });

            await segarkanStok(product.id);

            return false;
        }

    } catch (e) {
        console.error(`[Auto-Redeem] CRITICAL EXCEPTION:`, e);
        return false;
    }
}
