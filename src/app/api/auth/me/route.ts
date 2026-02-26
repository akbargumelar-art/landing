// Old me route - replaced by better-auth session
import { NextResponse } from "next/server";
export async function GET() {
    return NextResponse.json({ error: "Use /api/auth/get-session instead" }, { status: 410 });
}
