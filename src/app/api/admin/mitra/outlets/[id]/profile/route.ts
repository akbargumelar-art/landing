import { NextResponse } from "next/server";

import { OUTLET_CATEGORIES, PJP_DAYS, PJP_TYPES } from "@/lib/mitra-outlet-options";
import { FIELD_PROFIL, gerbangMutasiOutlet, simpanPerubahanOutlet, tolakFieldAsing } from "@/lib/mitra-outlet-mutations";
import { normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

const teks = (nilai: unknown) => String(nilai ?? "").trim();

/**
 * Profil operasional outlet: identitas, kontak owner, wilayah, kategori, dan jadwal PJP.
 * Terpisah dari `PUT /outlets/[id]` yang mengelola seluruh kolom master -- role lapangan
 * tidak boleh memperoleh kemampuan menulis kolom penugasan hanya karena butuh mengubah nama.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const gerbang = await gerbangMutasiOutlet(id);
    if (gerbang.error) return gerbang.error;

    const body = await request.json().catch(() => ({}));
    const asing = tolakFieldAsing(body, FIELD_PROFIL);
    if (asing) return asing;

    const name = teks(body.name);
    const ownerName = teks(body.ownerName);
    const ownerPhone = normalizePhoneE164(teks(body.ownerPhone));
    const kabupaten = teks(body.kabupaten);
    const kecamatan = teks(body.kecamatan);
    const category = teks(body.category);
    const pjpDay = teks(body.pjpDay);
    const pjpType = teks(body.pjpType);

    if (!name) return NextResponse.json({ error: "Nama outlet tidak boleh kosong" }, { status: 400 });
    if (!ownerName) return NextResponse.json({ error: "Nama owner tidak boleh kosong" }, { status: 400 });
    // Nomor owner dipakai tombol WhatsApp di direktori publik -- nomor tidak valid membuat
    // tombol itu diam-diam rusak, jadi ditolak di sini, bukan disimpan apa adanya.
    if (ownerPhone.replace(/\D/g, "").length < 9) {
        return NextResponse.json({ error: "Nomor WhatsApp owner tidak valid" }, { status: 400 });
    }
    if (!kabupaten) return NextResponse.json({ error: "Kabupaten tidak boleh kosong" }, { status: 400 });
    if (!kecamatan) return NextResponse.json({ error: "Kecamatan tidak boleh kosong" }, { status: 400 });
    if (!(OUTLET_CATEGORIES as readonly string[]).includes(category)) {
        return NextResponse.json({ error: "Kategori outlet tidak dikenal" }, { status: 400 });
    }
    if (!(PJP_DAYS as readonly string[]).includes(pjpDay)) {
        return NextResponse.json({ error: "Hari PJP tidak dikenal" }, { status: 400 });
    }
    if (!(PJP_TYPES as readonly string[]).includes(pjpType)) {
        return NextResponse.json({ error: "Tipe PJP tidak dikenal" }, { status: 400 });
    }

    return simpanPerubahanOutlet({
        request,
        scope: gerbang.scope,
        outlet: gerbang.outlet,
        action: "PROFILE",
        perubahan: { name, ownerName, ownerPhone, kabupaten, kecamatan, category, pjpDay, pjpType },
    });
}
