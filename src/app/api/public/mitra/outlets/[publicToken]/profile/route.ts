import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutlets } from "@/db/schema";
import { pastikanBolehEdit, writeOutletEditLog } from "@/lib/mitra-outlet-edit";
import { OUTLET_CATEGORIES, PJP_DAYS, PJP_TYPES } from "@/lib/mitra-outlet-options";
import { MITRA_DETAIL_SESSION_COOKIE, getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

/**
 * Profil outlet yang boleh disunting dari halaman detail ber-OTP: identitas, kontak
 * owner, wilayah, kategori, dan jadwal PJP. ID Digipos dan Nomor RS sengaja tidak ada di
 * sini -- keduanya nomor administratif yang mengikat outlet ke sistem lain (Digipos,
 * dealer Telkomsel), bukan data profil yang wajar diubah sendiri oleh mitra/salesforce.
 * TAP, Salesforce, Territory, dan status outlet juga tidak dibuka lewat jalur ini karena
 * ketiganya penugasan/organisasi internal (pencocokan whitelist TAP, scoping laporan
 * admin) -- perubahannya tetap lewat admin.
 */
const KOLOM_BOLEH_EDIT = ["name", "ownerName", "ownerPhone", "kabupaten", "kecamatan", "category", "pjpDay", "pjpType"] as const;
type KolomBolehEdit = (typeof KOLOM_BOLEH_EDIT)[number];

function teks(nilai: unknown): string {
    return String(nilai ?? "").trim();
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const sessionToken = request.cookies.get(MITRA_DETAIL_SESSION_COOKIE)?.value;
    const izin = await pastikanBolehEdit(publicToken, sessionToken);

    if (!izin.ok) {
        return NextResponse.json({ error: izin.error }, { status: izin.status });
    }

    const akses = izin.akses;
    const body = await request.json().catch(() => ({}));

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
    // Nomor owner dipakai tombol WhatsApp di direktori publik -- nomor yang tidak valid
    // membuat tombol itu diam-diam rusak, jadi ditolak di sini, bukan disimpan apa adanya.
    if (ownerPhone.replace(/\D/g, "").length < 9) {
        return NextResponse.json({ error: "Nomor WhatsApp owner tidak valid" }, { status: 400 });
    }
    if (!kabupaten) return NextResponse.json({ error: "Kabupaten tidak boleh kosong" }, { status: 400 });
    if (!kecamatan) return NextResponse.json({ error: "Kecamatan tidak boleh kosong" }, { status: 400 });
    // Dicocokkan ke daftar tetap sama seperti branding: kolomnya enum di database.
    if (!(OUTLET_CATEGORIES as readonly string[]).includes(category)) {
        return NextResponse.json({ error: "Kategori outlet tidak dikenal" }, { status: 400 });
    }
    if (!(PJP_DAYS as readonly string[]).includes(pjpDay)) {
        return NextResponse.json({ error: "Hari PJP tidak dikenal" }, { status: 400 });
    }
    if (!(PJP_TYPES as readonly string[]).includes(pjpType)) {
        return NextResponse.json({ error: "Tipe PJP tidak dikenal" }, { status: 400 });
    }

    const usulan: Record<KolomBolehEdit, string> = { name, ownerName, ownerPhone, kabupaten, kecamatan, category, pjpDay, pjpType };
    const sebelum = akses.outlet;

    // Hanya kolom yang benar-benar berubah yang masuk update dan riwayat -- baris riwayat
    // yang mencatat "kabupaten: Cirebon -> Cirebon" untuk setiap penyimpanan cuma bising.
    const berubah = KOLOM_BOLEH_EDIT.filter((kolom) => usulan[kolom] !== teks(sebelum[kolom]));

    if (berubah.length === 0) {
        return NextResponse.json({ success: true, unchanged: true, outlet: usulan });
    }

    const perubahan = Object.fromEntries(berubah.map((kolom) => [kolom, usulan[kolom]])) as Partial<Record<KolomBolehEdit, string>>;

    // Kategori dan jadwal PJP sudah divalidasi terhadap daftar enum di atas, jadi aman
    // dicocokkan ke tipe union kolomnya di sini -- sama seperti endpoint branding.
    await db
        .update(mitraOutlets)
        .set(perubahan as Partial<typeof mitraOutlets.$inferInsert>)
        .where(eq(mitraOutlets.id, akses.outlet.id));

    await writeOutletEditLog({
        outletId: akses.outlet.id,
        actorType: "MITRA",
        actorPhone: akses.session.phoneE164,
        action: "PROFILE",
        before: Object.fromEntries(berubah.map((kolom) => [kolom, sebelum[kolom]])),
        after: perubahan,
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, outlet: usulan });
}
