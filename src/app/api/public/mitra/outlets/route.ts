import { NextResponse } from "next/server";
import { and, asc, count, eq, isNotNull, like, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutlets } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Batas jumlah penanda peta. Daftarnya berhalaman (24 per halaman), tetapi peta harus
 * menampilkan seluruh outlet yang cocok dengan filter -- kalau tidak, penanda akan
 * berubah-ubah setiap ganti halaman dan membingungkan. Dibatasi agar satu permintaan
 * tidak pernah menarik jumlah baris yang tak terduga.
 */
const BATAS_PENANDA = 1000;

/** Koordinat di luar rentang ini pasti salah input, jadi outlet-nya tidak dipetakan. */
function koordinatSah(lat: number | null, lng: number | null): lat is number {
    return (
        typeof lat === "number" && typeof lng === "number" &&
        Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
        // 0,0 adalah nilai default yang lazim muncul dari impor yang gagal, bukan lokasi nyata.
        !(lat === 0 && lng === 0)
    );
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const kabupaten = (url.searchParams.get("kabupaten") || "").trim();
    const tap = (url.searchParams.get("tap") || "").trim();
    const view = url.searchParams.get("view");
    const page = Math.max(Number(url.searchParams.get("page") || "1"), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || "24"), 1), 48);

    const filters: SQL[] = [eq(mitraOutlets.status, "ACTIVE")];
    if (q) {
        filters.push(or(
            like(mitraOutlets.name, `%${q}%`),
            like(mitraOutlets.outletCode, `%${q}%`),
            like(mitraOutlets.kabupaten, `%${q}%`),
            like(mitraOutlets.kecamatan, `%${q}%`),
            like(mitraOutlets.tap, `%${q}%`)
        ) as SQL);
    }
    if (kabupaten) filters.push(eq(mitraOutlets.kabupaten, kabupaten));
    if (tap) filters.push(eq(mitraOutlets.tap, tap));

    const where = and(...filters);

    // Mode peta: hanya penanda, tanpa halaman, dan hanya outlet yang punya koordinat.
    // Muatannya sengaja dijaga tipis karena dipanggil bersamaan dengan daftar.
    if (view === "map") {
        const rows = await db
            .select({
                publicToken: mitraOutlets.publicToken,
                outletCode: mitraOutlets.outletCode,
                name: mitraOutlets.name,
                kabupaten: mitraOutlets.kabupaten,
                kecamatan: mitraOutlets.kecamatan,
                latitude: mitraOutlets.latitude,
                longitude: mitraOutlets.longitude,
            })
            .from(mitraOutlets)
            .where(and(where, isNotNull(mitraOutlets.latitude), isNotNull(mitraOutlets.longitude)))
            .orderBy(asc(mitraOutlets.name))
            .limit(BATAS_PENANDA);

        const markers = rows.filter((row) => koordinatSah(row.latitude, row.longitude));

        const [[cocokRow]] = await Promise.all([
            db.select({ value: count() }).from(mitraOutlets).where(where),
        ]);

        return NextResponse.json({
            markers,
            // Selisih ini dipakai halaman untuk memberi tahu pengguna bahwa sebagian
            // outlet tidak muncul di peta karena koordinatnya belum diisi.
            totalCocok: cocokRow?.value || 0,
            tanpaKoordinat: Math.max((cocokRow?.value || 0) - markers.length, 0),
            dibatasi: rows.length >= BATAS_PENANDA,
        });
    }

    const [[totalRow], outlets, filterRows] = await Promise.all([
        db.select({ value: count() }).from(mitraOutlets).where(where),
        db
            .select({
                publicToken: mitraOutlets.publicToken,
                outletCode: mitraOutlets.outletCode,
                name: mitraOutlets.name,
                tap: mitraOutlets.tap,
                kabupaten: mitraOutlets.kabupaten,
                kecamatan: mitraOutlets.kecamatan,
                category: mitraOutlets.category,
                pjpDay: mitraOutlets.pjpDay,
                pjpType: mitraOutlets.pjpType,
                branding: mitraOutlets.branding,
                photoUrl: mitraOutlets.photoUrl,
            })
            .from(mitraOutlets)
            .where(where)
            .orderBy(asc(mitraOutlets.name))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        db
            .select({ kabupaten: mitraOutlets.kabupaten, tap: mitraOutlets.tap })
            .from(mitraOutlets)
            .where(eq(mitraOutlets.status, "ACTIVE")),
    ]);

    const total = totalRow?.value || 0;

    /**
     * Kedua daftar filter saling menyaring: pilihan TAP dibatasi kabupaten yang sedang
     * dipilih, dan sebaliknya. Nilai yang sedang terpilih selalu dimasukkan kembali,
     * kalau tidak kombinasi yang tidak punya outlet akan membuat select-nya tampak
     * kosong padahal state-nya masih terisi.
     */
    const opsiUnik = (nilai: (string | null)[], terpilih: string) =>
        Array.from(new Set([...nilai, terpilih].filter((item): item is string => Boolean(item)))).sort();

    return NextResponse.json({
        outlets,
        total,
        page,
        pageSize,
        pageCount: Math.max(Math.ceil(total / pageSize), 1),
        filters: {
            kabupaten: opsiUnik(
                filterRows.filter((row) => !tap || row.tap === tap).map((row) => row.kabupaten),
                kabupaten
            ),
            tap: opsiUnik(
                filterRows.filter((row) => !kabupaten || row.kabupaten === kabupaten).map((row) => row.tap),
                tap
            ),
        },
    });
}
