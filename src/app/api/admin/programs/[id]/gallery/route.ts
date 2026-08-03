import { NextResponse } from "next/server";
import { db } from "@/db";
import { programs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/admin-auth";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    try {
        const { id } = await params;
        const body = await request.json();
        const { gallery } = body;

        if (!gallery || !Array.isArray(gallery)) {
            return NextResponse.json({ error: "Invalid gallery data" }, { status: 400 });
        }

        await db.update(programs).set({
            gallery: JSON.stringify(gallery),
        }).where(eq(programs.id, id));

        const [program] = await db.select().from(programs).where(eq(programs.id, id));
        return NextResponse.json(program);
    } catch (error) {
        console.error("Program Gallery PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
