import { NextResponse } from "next/server";
import { db } from "@/db";
import { winners } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { photoUrl } = body;

        if (typeof photoUrl !== "string") {
            return NextResponse.json({ error: "Invalid photoUrl" }, { status: 400 });
        }

        await db.update(winners).set({
            photoUrl: photoUrl,
        }).where(eq(winners.id, id));

        const [winner] = await db.select().from(winners).where(eq(winners.id, id));
        return NextResponse.json(winner);
    } catch (error) {
        console.error("Winner Photo PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
