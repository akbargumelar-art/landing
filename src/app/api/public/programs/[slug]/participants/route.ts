import { NextResponse } from "next/server";
import { db } from "@/db";
import {
    programs,
    dynamicForms,
    formSubmissions,
    submissionValues,
    formFields,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ParticipantEntry {
    name: string;
    phone: string;
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

        const formIds = forms.map((f) => f.id);

        // Get all submissions for these forms
        const allSubmissions: { id: string; period: string }[] = [];
        for (const formId of formIds) {
            const subs = await db
                .select({ id: formSubmissions.id, period: formSubmissions.period })
                .from(formSubmissions)
                .where(eq(formSubmissions.formId, formId));
            allSubmissions.push(...subs);
        }

        if (allSubmissions.length === 0) {
            return NextResponse.json([]);
        }

        // Group submissions by period
        const grouped: Record<string, ParticipantEntry[]> = {};

        for (const sub of allSubmissions) {
            const periodLabel = sub.period || "Tanpa Periode";

            const values = await db
                .select({ value: submissionValues.value, label: formFields.label })
                .from(submissionValues)
                .innerJoin(formFields, eq(submissionValues.fieldId, formFields.id))
                .where(eq(submissionValues.submissionId, sub.id));

            const nameField = values.find((v) => /nama/i.test(v.label));
            const phoneField = values.find((v) => /telepon|telp|hp|handphone|nomor/i.test(v.label));

            if (!grouped[periodLabel]) grouped[periodLabel] = [];
            grouped[periodLabel].push({
                name: nameField?.value ?? "",
                phone: phoneField?.value ?? "",
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
