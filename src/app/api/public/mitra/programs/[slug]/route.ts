import { NextResponse } from "next/server";

import { getPublicProgramDetail, normalizeTargetType } from "@/lib/mitra-programs";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const url = new URL(request.url);
    const targetType = normalizeTargetType(url.searchParams.get("targetType"));
    const data = await getPublicProgramDetail(slug, targetType, url.searchParams.get("q") || "");

    if (!data) {
        return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(data);
}
