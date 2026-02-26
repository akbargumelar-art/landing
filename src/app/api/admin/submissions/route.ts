import { NextResponse } from "next/server";
import { db } from "@/db";
import { formSubmissions, submissionValues, formFields, dynamicForms, programs, winners } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// GET submissions with filters
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const programId = searchParams.get("programId");
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        // Get all submissions
        let allSubmissions = await db.select().from(formSubmissions).orderBy(desc(formSubmissions.submittedAt));

        // Filter by status
        if (status) {
            allSubmissions = allSubmissions.filter((s) => s.status === status);
        }

        // Build full results with relations
        const result = [];
        for (const sub of allSubmissions) {
            const [form] = await db.select().from(dynamicForms).where(eq(dynamicForms.id, sub.formId));
            if (!form) continue;

            // Filter by programId
            if (programId && form.programId !== programId) continue;

            const [program] = await db
                .select({ id: programs.id, title: programs.title })
                .from(programs)
                .where(eq(programs.id, form.programId));

            const fields = await db.select().from(formFields).where(eq(formFields.formId, form.id));

            const values = await db.select().from(submissionValues).where(eq(submissionValues.submissionId, sub.id));
            const valuesWithField = values.map((v) => ({
                ...v,
                field: fields.find((f) => f.id === v.fieldId) || null,
            }));

            const [winner] = await db.select().from(winners).where(eq(winners.submissionId, sub.id));

            result.push({
                ...sub,
                form: { ...form, program: program || null, fields },
                values: valuesWithField,
                winner: winner || null,
            });
        }

        // Apply search filter
        let filtered = result;
        if (search) {
            const q = search.toLowerCase();
            filtered = result.filter((s) =>
                s.values.some(
                    (v) =>
                        v.value.toLowerCase().includes(q) ||
                        (v.field?.label || "").toLowerCase().includes(q)
                )
            );
        }

        return NextResponse.json(filtered);
    } catch (error) {
        console.error("Submissions GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
