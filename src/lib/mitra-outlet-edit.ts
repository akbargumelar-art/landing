import { and, desc, eq, gt } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraDetailSessions, mitraOutletEditLogs, mitraOutlets } from "@/db/schema";
import { hashSessionToken, maskPhone } from "@/lib/mitra-utils";
import { findMatchingWhitelist } from "@/lib/mitra-data";
import { PESAN_TIDAK_BOLEH_EDIT, bolehEditOutlet } from "@/lib/mitra-whitelist-roles";

export type MitraEditAction = "PHOTO" | "LOCATION" | "BRANDING";

/**
 * Mengembalikan outlet beserta sesi detail yang sah, atau null.
 *
 * Dipakai endpoint yang MENGUBAH data, jadi pemeriksaannya harus mengikat sesi ke outlet
 * yang sedang diedit -- bukan sekadar "punya sesi yang masih berlaku". Tanpa ikatan itu,
 * satu OTP untuk outlet A bisa dipakai menyunting outlet B.
 */
export async function getEditableOutlet(publicToken: string, sessionToken: string | undefined) {
    if (!sessionToken) return null;

    const [outlet] = await db
        .select()
        .from(mitraOutlets)
        .where(eq(mitraOutlets.publicToken, publicToken))
        .limit(1);

    if (!outlet) return null;

    const [session] = await db
        .select()
        .from(mitraDetailSessions)
        .where(and(
            eq(mitraDetailSessions.tokenHash, hashSessionToken(sessionToken)),
            eq(mitraDetailSessions.outletId, outlet.id),
            gt(mitraDetailSessions.expiresAt, new Date())
        ))
        .limit(1);

    if (!session) return null;

    // Peran pemegang nomor menentukan boleh-tidaknya menyunting. Diambil di sini, bukan di
    // tiap endpoint, supaya tidak ada jalur ubah yang lupa memeriksanya.
    const whitelist = await findMatchingWhitelist(session.phoneE164, { id: outlet.id, tap: outlet.tap });
    const keterangan = whitelist?.keterangan || null;

    return { outlet, session, keterangan, bolehEdit: bolehEditOutlet(keterangan) };
}

/** Pemeriksaan gabungan untuk endpoint yang mengubah data outlet. */
type HasilIzin =
    | { ok: false; error: string; status: 401 | 403 }
    | { ok: true; akses: NonNullable<Awaited<ReturnType<typeof getEditableOutlet>>> };

export async function pastikanBolehEdit(
    publicToken: string,
    sessionToken: string | undefined
): Promise<HasilIzin> {
    const akses = await getEditableOutlet(publicToken, sessionToken);

    if (!akses) return { ok: false, error: "Verifikasi OTP diperlukan untuk mengubah data outlet", status: 401 };
    if (!akses.bolehEdit) return { ok: false, error: PESAN_TIDAK_BOLEH_EDIT, status: 403 };

    return { ok: true, akses };
}

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
