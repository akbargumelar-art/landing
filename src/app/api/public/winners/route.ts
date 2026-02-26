import { NextResponse } from "next/server";
import { db } from "@/db";
import { winners, programs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const programId = searchParams.get("programId");

        let allWinners = await db.select().from(winners).orderBy(desc(winners.drawnAt));

        if (programId) {
            allWinners = allWinners.filter((w) => w.programId === programId);
        }

        const result = [];
        for (const w of allWinners) {
            const [program] = await db
                .select({ title: programs.title })
                .from(programs)
                .where(eq(programs.id, w.programId));
            result.push({ ...w, program: program || { title: "Unknown" } });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Public winners error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
