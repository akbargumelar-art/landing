import { NextResponse } from "next/server";

import { getPublicOutletByToken } from "@/lib/mitra-data";

export const dynamic = "force-dynamic";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const outlet = await getPublicOutletByToken(publicToken);

    if (!outlet) {
        return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ outlet });
}
