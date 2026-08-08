import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutlets } from "@/db/schema";
import { getEditableOutlet, writeOutletEditLog } from "@/lib/mitra-outlet-edit";
import { OUTLET_BRANDINGS } from "@/lib/mitra-outlet-options";
import { MITRA_DETAIL_SESSION_COOKIE, getClientIp } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const sessionToken = request.cookies.get(MITRA_DETAIL_SESSION_COOKIE)?.value;
    const akses = await getEditableOutlet(publicToken, sessionToken);

    if (!akses) {
        return NextResponse.json({ error: "Verifikasi OTP diperlukan untuk mengubah branding" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const branding = String(body.branding || "");

    // Dicocokkan ke daftar tetap, bukan diterima apa adanya: kolomnya enum di database,
    // dan nilai di luar daftar akan ditolak MySQL sebagai galat, bukan disimpan.
    if (!(OUTLET_BRANDINGS as readonly string[]).includes(branding)) {
        return NextResponse.json({ error: "Pilihan branding tidak dikenal" }, { status: 400 });
    }

    if (branding === akses.outlet.branding) {
        return NextResponse.json({ success: true, branding, unchanged: true });
    }

    await db
        .update(mitraOutlets)
        .set({ branding: branding as (typeof OUTLET_BRANDINGS)[number] })
        .where(eq(mitraOutlets.id, akses.outlet.id));

    await writeOutletEditLog({
        outletId: akses.outlet.id,
        actorType: "MITRA",
        actorPhone: akses.session.phoneE164,
        action: "BRANDING",
        before: { branding: akses.outlet.branding },
        after: { branding },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, branding });
}
