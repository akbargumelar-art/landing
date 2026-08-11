import { NextResponse } from "next/server";

import { OUTLET_BRANDINGS } from "@/lib/mitra-outlet-options";
import { FIELD_BRANDING, gerbangMutasiOutlet, simpanPerubahanOutlet, tolakFieldAsing } from "@/lib/mitra-outlet-mutations";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const gerbang = await gerbangMutasiOutlet(id);
    if (gerbang.error) return gerbang.error;

    const body = await request.json().catch(() => ({}));
    const asing = tolakFieldAsing(body, FIELD_BRANDING);
    if (asing) return asing;

    const branding = String(body.branding || "");

    // Dicocokkan ke daftar tetap, bukan diterima apa adanya: kolomnya enum di database, dan
    // nilai di luar daftar akan ditolak MySQL sebagai galat, bukan disimpan.
    if (!(OUTLET_BRANDINGS as readonly string[]).includes(branding)) {
        return NextResponse.json({ error: "Pilihan branding tidak dikenal" }, { status: 400 });
    }

    return simpanPerubahanOutlet({
        request,
        scope: gerbang.scope,
        outlet: gerbang.outlet,
        action: "BRANDING",
        perubahan: { branding },
    });
}
