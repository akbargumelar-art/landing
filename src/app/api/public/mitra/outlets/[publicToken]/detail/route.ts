import { NextRequest, NextResponse } from "next/server";

import { getOutletDetailWithSession } from "@/lib/mitra-data";
import { MITRA_DETAIL_SESSION_COOKIE } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const sessionToken = request.cookies.get(MITRA_DETAIL_SESSION_COOKIE)?.value;
    const data = await getOutletDetailWithSession(publicToken, sessionToken);

    if (!data) {
        return NextResponse.json({ error: "Sesi detail tidak valid atau sudah berakhir" }, { status: 401 });
    }

    // expiresAt tidak dikirim: akses detail tidak lagi dibatasi waktu setelah OTP
    // terverifikasi, jadi tidak ada hitungan mundur yang perlu ditampilkan.
    return NextResponse.json({
        outlet: data.outlet,
        details: data.details,
        performance: data.performance,
        marketShare: data.marketShare,
        editLogs: data.editLogs,
    });
}
