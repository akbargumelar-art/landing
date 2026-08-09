import { NextResponse } from "next/server";
import { and, asc, between, count, eq, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { indihomeOdp } from "@/db/schema";
import { jarakMeter } from "@/lib/geo";

export const dynamic = "force-dynamic";

/**
 * Titik ODP jumlahnya puluhan ribu, sedangkan Leaflet menggambar setiap penanda sebagai
 * elemen DOM tersendiri. Menggambar semuanya sekaligus membekukan browser, jadi yang
 * dikirim hanya yang berada di dalam area peta yang sedang terlihat.
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

    /**
     * Mode "sekitar titik": dipakai halaman profil outlet. Kotak pembatas dihitung dulu di
     * SQL supaya indeks koordinat terpakai, lalu jaraknya disaring tepat memakai haversine
     * di JavaScript -- kotak saja akan meloloskan titik di sudutnya yang sebenarnya lebih
     * jauh dari radius yang diminta.
     */
    const near = (url.searchParams.get("near") || "").split(",").map((bagian) => angka(bagian.trim()));
    const radius = Math.min(Math.max(Number(url.searchParams.get("radius")) || 1500, 100), 10000);
    const modeSekitar = near.length === 2 && near.every((nilai) => nilai !== null);

    if (modeSekitar) {
        const [lat, lng] = near as number[];
        // 1 derajat lintang kira-kira 111 km; bujur menyempit mengikuti kosinus lintang.
        const deltaLat = radius / 111_000;
        const deltaLng = radius / (111_000 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1));

        filters.push(between(indihomeOdp.latitude, lat - deltaLat, lat + deltaLat));
        filters.push(between(indihomeOdp.longitude, lng - deltaLng, lng + deltaLng));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [rows, [totalRow]] = await Promise.all([
        db
            .select({
                id: indihomeOdp.id,
                name: indihomeOdp.name,
                kabupaten: indihomeOdp.kabupaten,
                kecamatan: indihomeOdp.kecamatan,
                latitude: indihomeOdp.latitude,
                longitude: indihomeOdp.longitude,
                portTotal: indihomeOdp.portTotal,
                portUsed: indihomeOdp.portUsed,
                portAvailable: indihomeOdp.portAvailable,
                category: indihomeOdp.category,
            })
            .from(indihomeOdp)
            .where(where)
            .orderBy(asc(indihomeOdp.kabupaten), asc(indihomeOdp.kecamatan))
            .limit(BATAS_TITIK),
        db.select({ value: count() }).from(indihomeOdp).where(where),
    ]);

    const cocok = totalRow?.value || 0;

    if (modeSekitar) {
        const [lat, lng] = near as number[];
        const terdekat = rows
            .map((titik) => ({ ...titik, jarak: jarakMeter(lat, lng, titik.latitude, titik.longitude) }))
            .filter((titik) => titik.jarak <= radius)
            .sort((a, b) => a.jarak - b.jarak)
            .slice(0, 50);

        return NextResponse.json({ odp: terdekat, cocok: terdekat.length, dibatasi: false });
    }

    return NextResponse.json({
        odp: rows,
        // Dipakai halaman untuk memberi tahu bahwa sebagian titik belum tergambar,
        // alih-alih diam-diam menyembunyikannya.
        cocok,
        dibatasi: cocok > rows.length,
    });
}
