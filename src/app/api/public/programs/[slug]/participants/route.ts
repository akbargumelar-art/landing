/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
    programs,
    dynamicForms,
    formSubmissions,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export interface ParticipantEntry {
    id: string;
    participantName: string;
    participantPhone: string;
}

export interface ParticipantsByPeriod {
    period: string;
    participants: ParticipantEntry[];
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        // Find program by slug
        const [program] = await db
            .select({ id: programs.id })
            .from(programs)
            .where(eq(programs.slug, slug));

        if (!program) {
            return NextResponse.json([]);
        }

        // Get all forms linked to this program
        const forms = await db
            .select({ id: dynamicForms.id })
            .from(dynamicForms)
            .where(eq(dynamicForms.programId, program.id));

        if (forms.length === 0) {
            return NextResponse.json([]);
        }

        const formIds = forms.map((f: { id: string }) => f.id);

        // Get submissions matching to forms of the given program
        const allSubmissions = await db.query.formSubmissions.findMany({
            where: inArray(formSubmissions.formId, formIds),
            columns: {
                id: true,
                period: true,
                participantName: true,
                participantPhone: true,
            }
        });

        if (allSubmissions.length === 0) {
            return NextResponse.json([]);
        }

        // Group submissions by period
        const grouped: Record<string, ParticipantEntry[]> = {};

        for (const sub of allSubmissions) {
            const periodLabel = sub.period || "Tanpa Periode";

            if (!grouped[periodLabel]) grouped[periodLabel] = [];
            grouped[periodLabel].push({
                id: sub.id,
                participantName: sub.participantName,
                participantPhone: sub.participantPhone,
            });
        }

        // Convert to sorted array (most recent period first, alphabetically descending)
        const result: ParticipantsByPeriod[] = Object.entries(grouped)
            .map(([period, participants]) => ({ period, participants }))
            .sort((a, b) => b.period.localeCompare(a.period));

        return NextResponse.json(result);
    } catch (error) {
        console.error("Participants GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
