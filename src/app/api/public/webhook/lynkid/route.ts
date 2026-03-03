// DEPRECATED: This webhook handler has been replaced by /api/public/webhook/doku
// This file is kept only until the directory can be cleaned up.
import { NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json(
        { error: "This endpoint is deprecated. Use /api/public/webhook/doku instead." },
        { status: 410 }
    );
}
