import { NextResponse } from "next/server";
import { db } from "@/db";
import { winners, programs, formSubmissions, submissionValues, formFields } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// GET winner history
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
                .select({ id: programs.id, title: programs.title })
                .from(programs)
                .where(eq(programs.id, w.programId));

            const [submission] = await db.select().from(formSubmissions).where(eq(formSubmissions.id, w.submissionId));
            let valuesWithField: unknown[] = [];
            if (submission) {
                const values = await db.select().from(submissionValues).where(eq(submissionValues.submissionId, submission.id));
                valuesWithField = [];
                for (const v of values) {
                    const [field] = await db.select().from(formFields).where(eq(formFields.id, v.fieldId));
                    valuesWithField.push({ ...v, field: field || null });
                }
            }

            result.push({
                ...w,
                program: program || null,
                submission: submission ? { ...submission, values: valuesWithField } : null,
            });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Winners GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
