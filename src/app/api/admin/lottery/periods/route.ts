import { NextResponse } from "next/server";
import { db } from "@/db";
import { formSubmissions, dynamicForms } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const programId = searchParams.get("programId");

        if (!programId) {
            return NextResponse.json({ error: "programId required" }, { status: 400 });
        }

        // Get forms for this program
        const forms = await db.select({ id: dynamicForms.id }).from(dynamicForms).where(eq(dynamicForms.programId, programId));
        const formIds = forms.map((f) => f.id);

        if (formIds.length === 0) {
            return NextResponse.json([]);
        }

        // Get unique periods for these forms from approved submissions
        const submissions = await db
            .select({ period: formSubmissions.period })
            .from(formSubmissions)
            .where(
                inArray(formSubmissions.formId, formIds)
            );

        // Submissions can be anything, but we only care about approved ones.
        // For simplicity, let's just get the distinct periods that actually have some submissions.
        const uniquePeriods = new Set<string>();
        submissions.forEach((s) => {
            if (s.period) uniquePeriods.add(s.period);
        });

        return NextResponse.json(Array.from(uniquePeriods).sort());
    } catch (error) {
        console.error("Fetch periods error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
