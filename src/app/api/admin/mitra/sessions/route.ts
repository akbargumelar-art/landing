import { NextResponse } from "next/server";
import { desc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { mitraDetailSessions } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp, maskPhone, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

/**
 * Sesi baca hasil verifikasi OTP. Sesi memberi akses ke data pribadi outlet, jadi harus ada
 * cara mencabutnya tanpa menunggu masa berlakunya habis -- mis. ketika nomor petugas hilang
 * atau berganti pemilik.
 */
export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const rows = await db
        .select({
            phoneE164: mitraDetailSessions.phoneE164,
            outletId: mitraDetailSessions.outletId,
            programId: mitraDetailSessions.programId,
            expiresAt: mitraDetailSessions.expiresAt,
            createdAt: mitraDetailSessions.createdAt,
        })
        .from(mitraDetailSessions)
        .where(gt(mitraDetailSessions.expiresAt, new Date()))
        .orderBy(desc(mitraDetailSessions.createdAt))
        .limit(500);

    // Nomor disamarkan sama seperti di riwayat perubahan: daftar ini untuk menemukan sesi
    // yang perlu dicabut, bukan untuk memanen nomor telepon.
    return NextResponse.json({
        sessions: rows.map((row) => ({
            ...row,
            phoneMasked: maskPhone(row.phoneE164),
        })),
    });
}

export async function DELETE(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const phoneE164 = normalizePhoneE164(String(body.phone || ""));

    if (!phoneE164) {
        return NextResponse.json({ error: "Nomor wajib diisi" }, { status: 400 });
    }

    const aktif = await db
        .select({ id: mitraDetailSessions.id })
        .from(mitraDetailSessions)
        .where(eq(mitraDetailSessions.phoneE164, phoneE164));

    await db.delete(mitraDetailSessions).where(eq(mitraDetailSessions.phoneE164, phoneE164));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "REVOKE_OTP_SESSIONS",
        entity: "mitra_detail_session",
        entityId: phoneE164,
        // Nomor lengkap tidak ikut ditulis ke diff; entityId sudah cukup untuk penelusuran.
        diff: { revoked: aktif.length },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, revoked: aktif.length });
}
