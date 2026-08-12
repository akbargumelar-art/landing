import { NextResponse } from "next/server";

import { buildOutletMapsUrl } from "@/lib/mitra-outlet-options";
import { gerbangMutasiOutlet, simpanPerubahanOutlet, tolakFieldAsing } from "@/lib/mitra-outlet-mutations";

export const dynamic = "force-dynamic";

/** Ketelitian di atas ini hampir pasti hasil pembacaan IP/WiFi, bukan GPS. */
const BATAS_AKURASI_METER = 200;

/**
 * Koordinat berasal dari GPS perangkat, bukan ketikan. Mengetik lintang/bujur manual adalah
 * sumber titik outlet yang meleset -- satu digit tertukar sudah memindahkan penanda belasan
 * kilometer, dan tidak ada cara memverifikasinya dari layar admin.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const gerbang = await gerbangMutasiOutlet(id);
    if (gerbang.error) return gerbang.error;

    const body = await request.json().catch(() => ({}));
    const asing = tolakFieldAsing(body, ["latitude", "longitude", "accuracy"]);
    if (asing) return asing;

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

    // Koordinat ditolak, bukan disimpan diam-diam, ketika perangkat sendiri mengaku tidak
    // yakin -- titik outlet yang meleset ratusan meter lebih menyesatkan daripada titik yang
    // belum diisi sama sekali.
    if (Number.isFinite(accuracy) && accuracy > BATAS_AKURASI_METER) {
        return NextResponse.json(
            { error: `Sinyal lokasi kurang akurat (±${Math.round(accuracy)} m). Pastikan GPS aktif dan Anda berada di depan outlet, lalu coba lagi.` },
            { status: 422 }
        );
    }

    return simpanPerubahanOutlet({
        request,
        scope: gerbang.scope,
        outlet: gerbang.outlet,
        action: "LOCATION",
        perubahan: { latitude, longitude, locationUrl: buildOutletMapsUrl(latitude, longitude) || null },
    });
}
