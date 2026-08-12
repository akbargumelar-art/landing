import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraPrograms } from "@/db/schema";
import { requireRole } from "@/lib/admin-auth";
import { findParticipantsBulk, type ProgramTargetType } from "@/lib/mitra-programs";

export const dynamic = "force-dynamic";

/**
 * Mencari calon peserta massal. Sengaja POST meskipun tidak mengubah apa pun: daftar kode
 * yang ditempel admin bisa ribuan baris, jauh melewati batas panjang URL kalau dikirim
 * sebagai query string.
 *
 * Hasilnya hanya usulan -- penyimpanan tetap lewat aksi configure_participants, supaya
 * admin sempat memeriksa daftarnya sebelum program benar-benar berubah.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const [program] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id)).limit(1);
    if (!program) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const codes = Array.isArray(body.codes)
        ? (body.codes as unknown[]).map((value) => String(value))
        : typeof body.codes === "string"
            ? String(body.codes).split(/[\n,;\t]/)
            : [];

    const hasil = await findParticipantsBulk(program.targetType as ProgramTargetType, {
        codes,
        tap: body.tap ? String(body.tap) : undefined,
        kabupaten: body.kabupaten ? String(body.kabupaten) : undefined,
        kecamatan: body.kecamatan ? String(body.kecamatan) : undefined,
        category: body.category ? String(body.category) : undefined,
    });

    return NextResponse.json(hasil);
}
