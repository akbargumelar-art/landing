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
        const allSubmissions: { id: string }[] = [];
        for (const formId of formIds) {
            const subs = await db
                .select({ id: formSubmissions.id })
                .from(formSubmissions)
                .where(eq(formSubmissions.formId, formId));
            allSubmissions.push(...subs);
        }

        if (allSubmissions.length === 0) {
            return NextResponse.json([]);
        }

        // For each submission, extract name and phone fields
        const participants: { name: string; phone: string }[] = [];

        for (const sub of allSubmissions) {
            const values = await db
                .select({
                    value: submissionValues.value,
                    label: formFields.label,
                })
                .from(submissionValues)
                .innerJoin(formFields, eq(submissionValues.fieldId, formFields.id))
                .where(eq(submissionValues.submissionId, sub.id));

            // Find name and phone fields (case-insensitive label matching)
            const nameField = values.find((v) =>
                /nama/i.test(v.label)
            );
            const phoneField = values.find((v) =>
                /telepon|telp|hp|handphone|nomor/i.test(v.label)
            );

            if (nameField || phoneField) {
                participants.push({
                    name: nameField?.value ?? "",
                    phone: phoneField?.value ?? "",
                });
            }
        }

        return NextResponse.json(participants);
    } catch (error) {
        console.error("Participants GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
