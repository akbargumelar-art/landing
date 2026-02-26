// Old logout route - replaced by better-auth
import { NextResponse } from "next/server";
export async function POST() {
    return NextResponse.json({ error: "Use /api/auth/sign-out instead" }, { status: 410 });
}
