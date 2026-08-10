import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutlets } from "@/db/schema";
import { pastikanBolehEdit, writeOutletEditLog } from "@/lib/mitra-outlet-edit";
import { buildOutletMapsUrl } from "@/lib/mitra-outlet-options";
import { catatAktivitasKunjungan } from "@/lib/mitra-visit-notify";
import { MITRA_DETAIL_SESSION_COOKIE, getClientIp } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

/** Ketelitian di atas ini hampir pasti hasil pembacaan IP/WiFi, bukan GPS. */
const BATAS_AKURASI_METER = 200;

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
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = Number(body.accuracy);

    if (
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
        // 0,0 adalah nilai default yang lazim muncul dari pembacaan gagal, bukan lokasi nyata.
        (latitude === 0 && longitude === 0)
    ) {
        return NextResponse.json({ error: "Koordinat tidak valid" }, { status: 400 });
    }

    // Koordinat ditolak, bukan disimpan diam-diam, ketika perangkat sendiri mengaku
    // tidak yakin -- titik outlet yang meleset ratusan meter lebih menyesatkan daripada
    // titik yang belum diisi.
    if (Number.isFinite(accuracy) && accuracy > BATAS_AKURASI_METER) {
        return NextResponse.json(
            { error: `Sinyal lokasi kurang akurat (±${Math.round(accuracy)} m). Pastikan GPS aktif dan Anda berada di depan outlet, lalu coba lagi.` },
            { status: 422 }
        );
    }

    const locationUrl = buildOutletMapsUrl(latitude, longitude) || null;

    await db
        .update(mitraOutlets)
        .set({ latitude, longitude, locationUrl })
        .where(eq(mitraOutlets.id, akses.outlet.id));

    await writeOutletEditLog({
        outletId: akses.outlet.id,
        actorType: "MITRA",
        actorPhone: akses.session.phoneE164,
        action: "LOCATION",
        before: { latitude: akses.outlet.latitude, longitude: akses.outlet.longitude },
        after: { latitude, longitude, accuracy: Number.isFinite(accuracy) ? accuracy : null },
        ip: getClientIp(request),
    });

    // Ikut dikumpulkan ke notifikasi kunjungan yang sama dengan unggahan fotonya, sehingga
    // salesforce yang membetulkan titik peta lalu memotret outlet tetap menghasilkan satu pesan.
    await catatAktivitasKunjungan({
        outletId: akses.outlet.id,
        sessionId: akses.session.id,
        actorPhone: akses.session.phoneE164,
        lokasiBerubah: true,
    });

    return NextResponse.json({ success: true, latitude, longitude, locationUrl });
}
