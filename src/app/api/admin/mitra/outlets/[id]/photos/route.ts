import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutlets } from "@/db/schema";
import { writeAdminAuditLog } from "@/lib/admin-auth";
import { gerbangMutasiOutlet } from "@/lib/mitra-outlet-mutations";
import { findPhotoSlot } from "@/lib/mitra-outlet-photos";
import { writeOutletEditLog } from "@/lib/mitra-outlet-edit";
import { catatAktivitasKunjungan } from "@/lib/mitra-visit-notify";
import { getClientIp, hashValue } from "@/lib/mitra-utils";
import { saveUploadedImage } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kunci pengelompokan notifikasi kunjungan.
 *
 * Dulu satu kunjungan = satu sesi OTP. Petugas kini bekerja dengan akun login yang sesinya
 * berumur panjang, sehingga sesi tidak lagi menandai batas kunjungan. Diganti kombinasi
 * petugas + outlet + tanggal: empat foto yang diunggah di satu outlet pada hari yang sama
 * tetap menjadi satu pesan, sedangkan outlet berikutnya memulai pesan baru.
 *
 * Dipotong 36 karakter mengikuti lebar kolom session_id.
 */
function kunciKunjungan(userId: string, outletId: string): string {
    const tanggal = new Date().toISOString().slice(0, 10);
    return hashValue(`admin:${userId}:${outletId}:${tanggal}`).slice(0, 36);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const gerbang = await gerbangMutasiOutlet(id);
    if (gerbang.error) return gerbang.error;

    const formData = await request.formData().catch(() => null);
    if (!formData) {
        return NextResponse.json({ error: "Data unggahan tidak terbaca" }, { status: 400 });
    }

    // Slot dicocokkan ke daftar tetap, tidak dipakai langsung sebagai nama kolom -- nilai
    // kiriman tidak boleh menentukan kolom mana yang ditulis.
    const slot = findPhotoSlot(formData.get("slot") || "depan");
    if (!slot) {
        return NextResponse.json({ error: "Jenis foto tidak dikenal" }, { status: 400 });
    }

    // Foto langsung diperkecil ke 1600 px. Foto kamera ponsel berukuran 4-5 MB gagal
    // ditampilkan WhatsApp saat diteruskan ke group, dan 1600 px sudah jauh di atas ukuran
    // tampil terbesarnya di web -- jadi yang hilang cuma berat berkasnya.
    const hasil = await saveUploadedImage(formData.get("file") as File | null, {
        maxBytes: 5 * 1024 * 1024,
        publicUpload: true,
        maxDimensi: 1600,
    });

    if (!hasil.ok) {
        return NextResponse.json({ error: hasil.error }, { status: hasil.status || 400 });
    }

    const sekarang = new Date();
    const sebelum = gerbang.outlet[slot.urlColumn];
    const ip = getClientIp(request);

    await db
        .update(mitraOutlets)
        .set({ [slot.urlColumn]: hasil.url, [slot.atColumn]: sekarang })
        .where(eq(mitraOutlets.id, id));

    await writeOutletEditLog({
        outletId: id,
        actorType: "ADMIN",
        actorUserId: gerbang.scope.userId,
        action: "PHOTO",
        before: { slot: slot.key, url: sebelum },
        after: { slot: slot.key, label: slot.label, url: hasil.url },
        ip,
    });

    await writeAdminAuditLog({
        userId: gerbang.scope.userId,
        action: "OUTLET_PHOTO",
        entity: "mitra_outlet",
        entityId: id,
        diff: { slot: slot.key, before: sebelum, after: hasil.url },
        ip,
    });

    // Notifikasi group tidak dikirim di sini: foto diunggah satu per satu, jadi aktivitasnya
    // hanya dicatat dan satu pesan menyusul setelah kunjungan selesai.
    await catatAktivitasKunjungan({
        outletId: id,
        sessionId: kunciKunjungan(gerbang.scope.userId, id),
        actorPhone: null,
        foto: { slot: slot.key, label: slot.label, url: hasil.url! },
    });

    return NextResponse.json({ success: true, slot: slot.key, url: hasil.url, updatedAt: sekarang });
}

/**
 * Menghapus foto dari satu slot. Waktu pembaruannya ikut dikosongkan -- kolom itu adalah
 * dasar penilaian kunjungan mingguan, jadi membiarkannya terisi setelah fotonya hilang akan
 * membuat kunjungan yang tidak punya bukti tetap terhitung terealisasi.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const gerbang = await gerbangMutasiOutlet(id);
    if (gerbang.error) return gerbang.error;

    const url = new URL(request.url);
    const slot = findPhotoSlot(url.searchParams.get("slot") || "");
    if (!slot) {
        return NextResponse.json({ error: "Jenis foto tidak dikenal" }, { status: 400 });
    }

    const sebelum = gerbang.outlet[slot.urlColumn];
    if (!sebelum) {
        return NextResponse.json({ success: true, unchanged: true });
    }

    const ip = getClientIp(request);

    await db
        .update(mitraOutlets)
        .set({ [slot.urlColumn]: null, [slot.atColumn]: null })
        .where(eq(mitraOutlets.id, id));

    await writeOutletEditLog({
        outletId: id,
        actorType: "ADMIN",
        actorUserId: gerbang.scope.userId,
        action: "PHOTO",
        before: { slot: slot.key, url: sebelum },
        after: { slot: slot.key, url: null },
        ip,
    });

    await writeAdminAuditLog({
        userId: gerbang.scope.userId,
        action: "OUTLET_PHOTO_DELETE",
        entity: "mitra_outlet",
        entityId: id,
        diff: { slot: slot.key, before: sebelum },
        ip,
    });

    return NextResponse.json({ success: true, slot: slot.key });
}
