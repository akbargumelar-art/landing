import { desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOutletEditLogs } from "@/db/schema";
import { maskPhone } from "@/lib/mitra-utils";

export type MitraEditAction = "PHOTO" | "LOCATION" | "BRANDING" | "PROFILE";

/**
 * Kode galat stabil untuk klien: dipakai UI lama/bookmark untuk mengarahkan pengguna ke
 * halaman login alih-alih meminta OTP ulang -- yang tidak akan pernah berhasil.
 */
export const KODE_WAJIB_LOGIN = "LOGIN_REQUIRED_FOR_WRITE";

export const PESAN_WAJIB_LOGIN =
    "Untuk mengubah data, silakan masuk menggunakan akun Salesforce atau Supervisor.";

export async function writeOutletEditLog(input: {
    outletId: string;
    actorType: "MITRA" | "ADMIN";
    actorPhone?: string | null;
    actorUserId?: string | null;
    action: MitraEditAction;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ip?: string | null;
}) {
    await db.insert(mitraOutletEditLogs).values({
        id: uuid(),
        outletId: input.outletId,
        actorType: input.actorType,
        actorPhone: input.actorPhone || null,
        actorUserId: input.actorUserId || null,
        action: input.action,
        beforeJson: input.before || null,
        afterJson: input.after || null,
        ip: input.ip || null,
        createdAt: new Date(),
    });
}

/**
 * Riwayat untuk halaman detail publik. Nomor pengedit disamarkan: halaman ini memang
 * terkunci OTP, tetapi yang membukanya belum tentu orang yang sama dengan yang mengedit.
 */
export async function getOutletEditLogs(outletId: string, limit = 20) {
    const rows = await db
        .select()
        .from(mitraOutletEditLogs)
        .where(eq(mitraOutletEditLogs.outletId, outletId))
        .orderBy(desc(mitraOutletEditLogs.createdAt))
        .limit(limit);

    return rows.map((row) => ({
        id: row.id,
        action: row.action,
        actorType: row.actorType,
        actorLabel: row.actorType === "ADMIN" ? "Admin ABK" : maskPhone(row.actorPhone || ""),
        before: row.beforeJson,
        after: row.afterJson,
        createdAt: row.createdAt,
    }));
}
