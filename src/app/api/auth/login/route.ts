// Old login route - replaced by better-auth at /api/auth/[...all]
import { NextResponse } from "next/server";
export async function POST() {
    return NextResponse.json({ error: "Use /api/auth/sign-in/email instead" }, { status: 410 });
}
