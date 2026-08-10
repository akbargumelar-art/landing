import { NextResponse } from "next/server";

import { getPublicPrograms, normalizeTargetType } from "@/lib/mitra-programs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const targetType = normalizeTargetType(new URL(request.url).searchParams.get("targetType"));
    const programs = await getPublicPrograms(targetType);
    return NextResponse.json({ programs });
}
