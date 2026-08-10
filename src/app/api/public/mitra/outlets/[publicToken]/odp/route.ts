import { NextRequest, NextResponse } from "next/server";
import { and, between } from "drizzle-orm";

import { db } from "@/db";
import { indihomeOdp } from "@/db/schema";
import { jarakMeter } from "@/lib/geo";
import { getOutletWithValidDetailSession } from "@/lib/mitra-data";
import { MITRA_DETAIL_SESSION_COOKIE } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

const RADIUS_METER = 1500;
const BATAS_KANDIDAT = 1500;
const BATAS_HASIL = 50;

/**
 * Rincian sebaran ODP hanya tersedia di dalam detail outlet. Pusat pencarian diambil dari
 * outlet pada server, bukan query pengguna, supaya sesi OTP outlet A tidak bisa dipakai
 * memindai rincian ODP di lokasi sembarang.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const sessionToken = request.cookies.get(MITRA_DETAIL_SESSION_COOKIE)?.value;
    const access = await getOutletWithValidDetailSession(publicToken, sessionToken);

    if (!access) {
        return NextResponse.json({ error: "Verifikasi OTP diperlukan untuk membuka detail sebaran ODP" }, { status: 401 });
    }

    const latitude = access.outletRecord.latitude;
    const longitude = access.outletRecord.longitude;
    if (latitude == null || longitude == null) {
        return NextResponse.json({ odp: [], cocok: 0 });
    }

    // Kotak pembatas memperkecil kandidat di SQL; haversine di bawah memastikan sudut
    // kotak yang berada di luar radius tidak ikut dikembalikan.
    const deltaLat = RADIUS_METER / 111_000;
    const deltaLng = RADIUS_METER / (111_000 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.1));

    const rows = await db
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
        .where(and(
            between(indihomeOdp.latitude, latitude - deltaLat, latitude + deltaLat),
            between(indihomeOdp.longitude, longitude - deltaLng, longitude + deltaLng)
        ))
        .limit(BATAS_KANDIDAT);

    const odp = rows
        .map((titik) => ({
            ...titik,
            jarak: jarakMeter(latitude, longitude, titik.latitude, titik.longitude),
        }))
        .filter((titik) => titik.jarak <= RADIUS_METER)
        .sort((a, b) => a.jarak - b.jarak)
        .slice(0, BATAS_HASIL);

    return NextResponse.json({ odp, cocok: odp.length });
}
