import { NextResponse } from "next/server";
import { db } from "@/db";
import {
    programs,
    dynamicForms,
    formSubmissions,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

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

        const formIds = forms.map((f: { id: string }) => f.id);

        // Get submissions matching to forms of the given program
        const allSubmissions = await db.query.formSubmissions.findMany({
            where: inArray(formSubmissions.formId, formIds),
            with: {
                submissionValues: {
                    with: {
                        field: true,
                    },
                },
            },
        });

        if (allSubmissions.length === 0) {
            return NextResponse.json([]);
        }

        // Group submissions by period
        const grouped: Record<string, ParticipantEntry[]> = {};

        for (const sub of allSubmissions) {
            const periodLabel = sub.period || "Tanpa Periode";

            const values = (sub as any).submissionValues || [];

            interface SubValType {
                field: { label: string | null; fieldType: string | null } | null;
                value: string;
            }

            let nameField = values.find((v: SubValType) => v.field?.fieldType === "name");
            if (!nameField) nameField = values.find((v: SubValType) => v.field?.label && /nama/i.test(v.field.label) && !/phone|email|hp|telp/i.test(v.field.fieldType || "") && !/phone|email|hp|telp|wa/i.test(v.field.label || ""));
            if (!nameField) nameField = values.find((v: SubValType) => /text/i.test(v.field?.fieldType || "") && !/phone|email|hp|telp|wa/i.test(v.field?.label || ""));

            let phoneField = values.find((v: SubValType) => v.field?.fieldType === "phone");
            if (!phoneField) phoneField = values.find((v: SubValType) => v.field?.label && /whatsapp|hp/i.test(v.field.label));
            if (!phoneField) phoneField = values.find((v: SubValType) => /number/i.test(v.field?.fieldType || ""));

            const finalName = nameField?.value?.trim() || `Peserta #${sub.id.substring(0, 6)}`;
            const finalPhone = phoneField?.value?.trim() || "";

            if (!grouped[periodLabel]) grouped[periodLabel] = [];
            grouped[periodLabel].push({
                name: finalName,
                phone: finalPhone,
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
