import { NextResponse } from "next/server";

import { getPublicMitraProgramDetail } from "@/lib/mitra-data";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const search = new URL(request.url).searchParams.get("q") || "";
    const data = await getPublicMitraProgramDetail(slug, search);

    if (!data) {
        return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(data);
}
