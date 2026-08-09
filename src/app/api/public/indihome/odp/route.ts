import { NextResponse } from "next/server";
import { and, asc, eq, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { indihomeOdp } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Batas titik yang dikirim sekali jalan. ODP jumlahnya bisa ribuan dan seluruhnya
 * digambar sebagai penanda di peta; tanpa batas, satu permintaan bisa membekukan browser.
 */
const BATAS_TITIK = 2000;

export async function GET(request: Request) {
    const url = new URL(request.url);
    const kabupaten = (url.searchParams.get("kabupaten") || "").trim();
    const kecamatan = (url.searchParams.get("kecamatan") || "").trim();

    const filters: SQL[] = [];
    if (kabupaten) filters.push(eq(indihomeOdp.kabupaten, kabupaten));
    if (kecamatan) filters.push(eq(indihomeOdp.kecamatan, kecamatan));

    const rows = await db
        .select({
            id: indihomeOdp.id,
            code: indihomeOdp.code,
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
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(asc(indihomeOdp.kabupaten), asc(indihomeOdp.kecamatan))
        .limit(BATAS_TITIK);

    return NextResponse.json({ odp: rows, dibatasi: rows.length >= BATAS_TITIK });
}
