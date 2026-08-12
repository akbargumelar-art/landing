import { NextResponse } from "next/server";
import { and, asc, between, count, eq, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { indihomeOdp } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Titik ODP jumlahnya puluhan ribu, sedangkan Leaflet menggambar setiap penanda sebagai
 * elemen DOM tersendiri. Menggambar semuanya sekaligus membekukan browser, jadi yang
 * dikirim hanya yang berada di dalam area peta yang sedang terlihat. Respons publik
 * sengaja hanya berisi ID dan koordinat; rincian ODP dilayani endpoint detail ber-OTP.
 */
const BATAS_TITIK = 1500;

function angka(nilai: string | null): number | null {
    const hasil = Number(nilai);
    return Number.isFinite(hasil) ? hasil : null;
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const kabupaten = (url.searchParams.get("kabupaten") || "").trim();

    const filters: SQL[] = [];
    if (kabupaten) filters.push(eq(indihomeOdp.kabupaten, kabupaten));

    // bbox = barat,selatan,timur,utara sesuai urutan getBounds().toBBoxString() Leaflet.
    const bbox = (url.searchParams.get("bbox") || "").split(",").map((bagian) => angka(bagian.trim()));
    if (bbox.length === 4 && bbox.every((nilai) => nilai !== null)) {
        const [barat, selatan, timur, utara] = bbox as number[];
        filters.push(between(indihomeOdp.latitude, Math.min(selatan, utara), Math.max(selatan, utara)));
        filters.push(between(indihomeOdp.longitude, Math.min(barat, timur), Math.max(barat, timur)));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [rows, [totalRow]] = await Promise.all([
        db
            .select({
                id: indihomeOdp.id,
                latitude: indihomeOdp.latitude,
                longitude: indihomeOdp.longitude,
            })
            .from(indihomeOdp)
            .where(where)
            .orderBy(asc(indihomeOdp.kabupaten), asc(indihomeOdp.kecamatan))
            .limit(BATAS_TITIK),
        db.select({ value: count() }).from(indihomeOdp).where(where),
    ]);

    const cocok = totalRow?.value || 0;

    return NextResponse.json({
        odp: rows,
        // Dipakai halaman untuk memberi tahu bahwa sebagian titik belum tergambar,
        // alih-alih diam-diam menyembunyikannya.
        cocok,
        dibatasi: cocok > rows.length,
    });
}
