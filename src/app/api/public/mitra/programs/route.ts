import { NextResponse } from "next/server";

import { getPublicMitraPrograms } from "@/lib/mitra-data";

export const dynamic = "force-dynamic";

export async function GET() {
    const programs = await getPublicMitraPrograms();
    return NextResponse.json({ programs });
}
