import { NextResponse } from "next/server";
import { and, between, eq, isNotNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { indihomeOdp, mitraOutlets } from "@/db/schema";
import { jarakMeter } from "@/lib/geo";
import { getMitraOutletRecordByToken } from "@/lib/mitra-data";

export const dynamic = "force-dynamic";

const RADIUS_METER = 1500;
const BATAS_KANDIDAT = 1500;
const BATAS_ODP = 200;
const BATAS_OUTLET = 50;

/**
 * Peta sekitar outlet untuk pengunjung yang belum melewati OTP.
 *
 * Bedanya dengan endpoint /odp yang ber-OTP ada pada isi, bukan pada radiusnya: di sini
 * ODP hanya dikembalikan sebagai id + koordinat. Nama, jumlah port, occupancy, dan kategori
 * tetap tertahan di balik OTP, sama seperti keputusan sebelumnya. Yang publik hanyalah
 * fakta "ada titik ODP di sini" -- sebaran titiknya memang sudah publik lewat peta /mitra.
 *
 * Outlet lain di sekitar ikut dikirim karena datanya juga sudah publik di direktori
 * /mitra; menampilkannya di sini hanya menghemat langkah pengunjung.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const outlet = await getMitraOutletRecordByToken(publicToken);

    if (!outlet) {
        return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 });
    }

    const latitude = outlet.latitude;
    const longitude = outlet.longitude;
    if (latitude == null || longitude == null) {
        return NextResponse.json({ odp: [], outlets: [], radiusMeter: RADIUS_METER });
    }

    // Kotak pembatas memperkecil kandidat di SQL; haversine di bawah membuang sudut kotak
    // yang sebenarnya berada di luar radius.
    const deltaLat = RADIUS_METER / 111_000;
    const deltaLng = RADIUS_METER / (111_000 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.1));

    const [barisOdp, barisOutlet] = await Promise.all([
        db
            .select({
                id: indihomeOdp.id,
                latitude: indihomeOdp.latitude,
                longitude: indihomeOdp.longitude,
            })
            .from(indihomeOdp)
            .where(and(
                between(indihomeOdp.latitude, latitude - deltaLat, latitude + deltaLat),
                between(indihomeOdp.longitude, longitude - deltaLng, longitude + deltaLng)
            ))
            .limit(BATAS_KANDIDAT),
        db
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
            .where(and(
                eq(mitraOutlets.status, "ACTIVE"),
                ne(mitraOutlets.publicToken, publicToken),
                isNotNull(mitraOutlets.latitude),
                isNotNull(mitraOutlets.longitude),
                between(mitraOutlets.latitude, latitude - deltaLat, latitude + deltaLat),
                between(mitraOutlets.longitude, longitude - deltaLng, longitude + deltaLng)
            ))
            .limit(BATAS_KANDIDAT),
    ]);

    const dalamRadius = <T extends { latitude: number | null; longitude: number | null }>(rows: T[]) =>
        rows
            .filter((baris): baris is T & { latitude: number; longitude: number } =>
                baris.latitude != null && baris.longitude != null)
            .map((baris) => ({ ...baris, jarak: jarakMeter(latitude, longitude, baris.latitude, baris.longitude) }))
            .filter((baris) => baris.jarak <= RADIUS_METER)
            .sort((a, b) => a.jarak - b.jarak);

    const odp = dalamRadius(barisOdp)
        .slice(0, BATAS_ODP)
        // jarak tidak ikut dikirim: itu sudah bagian dari rincian yang dikunci OTP.
        .map(({ id, latitude: lat, longitude: lng }) => ({ id, latitude: lat, longitude: lng }));

    const outlets = dalamRadius(barisOutlet).slice(0, BATAS_OUTLET);

    return NextResponse.json({ odp, outlets, radiusMeter: RADIUS_METER });
}
