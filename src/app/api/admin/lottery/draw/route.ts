import { NextResponse } from "next/server";
import { db } from "@/db";
import { formSubmissions, submissionValues, formFields, dynamicForms, winners } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// POST draw a winner
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { programId } = body;

        if (!programId) {
            return NextResponse.json({ error: "programId required" }, { status: 400 });
        }

        // Get approved submissions for this program
        const forms = await db.select().from(dynamicForms).where(eq(dynamicForms.programId, programId));
        const formIds = forms.map((f) => f.id);

        if (formIds.length === 0) {
            return NextResponse.json({ error: "Tidak ada form untuk program ini" }, { status: 400 });
        }

        // Get all approved submissions for those forms
        const allSubmissions = [];
        for (const fid of formIds) {
            const subs = await db
                .select()
                .from(formSubmissions)
                .where(and(eq(formSubmissions.formId, fid), eq(formSubmissions.status, "approved")));
            allSubmissions.push(...subs);
        }

        // Filter out those who already won
        const eligible = [];
        for (const sub of allSubmissions) {
            const [existingWinner] = await db.select().from(winners).where(eq(winners.submissionId, sub.id));
            if (!existingWinner) {
                const values = await db.select().from(submissionValues).where(eq(submissionValues.submissionId, sub.id));
                const fields = [];
                for (const v of values) {
                    const [field] = await db.select().from(formFields).where(eq(formFields.id, v.fieldId));
                    fields.push({ ...v, field: field || null });
                }
                eligible.push({ ...sub, values: fields });
            }
        }

        if (eligible.length === 0) {
            return NextResponse.json({ error: "Tidak ada peserta yang memenuhi syarat" }, { status: 400 });
        }

        // Random selection
        const randomIndex = Math.floor(Math.random() * eligible.length);
        const selected = eligible[randomIndex];

        // Get name from submission values (first text field)
        const nameValue = selected.values.find(
            (v: { field: { fieldType: string } | null; value: string }) => v.field?.fieldType === "text" && v.value
        );
        const winnerName = nameValue?.value || "Peserta #" + selected.id.slice(0, 6);

        // Save winner
        const winnerId = uuid();
        await db.insert(winners).values({
            id: winnerId,
            programId,
            submissionId: selected.id,
            name: winnerName,
            drawnAt: new Date(),
        });

        const [winner] = await db.select().from(winners).where(eq(winners.id, winnerId));

        return NextResponse.json({
            winner,
            totalEligible: eligible.length,
            allNames: eligible.map((s) => {
                const nv = s.values.find(
                    (v: { field: { fieldType: string } | null; value: string }) => v.field?.fieldType === "text" && v.value
                );
                return nv?.value || "Peserta";
            }),
        });
    } catch (error) {
        console.error("Lottery draw error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
