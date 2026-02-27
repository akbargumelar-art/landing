import { NextResponse } from "next/server";
import { db } from "@/db";
import { winners, programs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

interface WinnerRow {
    id: string;
    programId: string;
    submissionId: string;
    name: string;
    phone: string;
    outlet: string;
    period: string;
    photoUrl: string;
    drawnAt: Date;
    program: { title: string };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const programId = searchParams.get("programId");

        let allWinners = await db.select().from(winners).orderBy(desc(winners.drawnAt));

        if (programId) {
            allWinners = allWinners.filter((w) => w.programId === programId);
        }

        const result: WinnerRow[] = [];
        for (const w of allWinners) {
            const [program] = await db
                .select({ title: programs.title })
                .from(programs)
                .where(eq(programs.id, w.programId));
            result.push({ ...w, program: program || { title: "Unknown" } });
        }

        // Group by period, sorted newest period first
        const grouped: Record<string, WinnerRow[]> = {};
        for (const w of result) {
            const p = w.period || "Tanpa Periode";
            if (!grouped[p]) grouped[p] = [];
            grouped[p].push(w);
        }

        const groupedResult = Object.entries(grouped)
            .map(([period, periodWinners]) => ({ period, winners: periodWinners }))
            .sort((a, b) => b.period.localeCompare(a.period));

        return NextResponse.json(groupedResult);
    } catch (error) {
        console.error("Public winners error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
