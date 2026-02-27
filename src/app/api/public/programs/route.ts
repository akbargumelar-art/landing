import { NextResponse } from "next/server";
import { db } from "@/db";
import { programs, dynamicForms } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";

export async function GET() {
    try {
        const programsData = await db
            .select({
                program: programs,
                formId: dynamicForms.id,
            })
            .from(programs)
            .leftJoin(
                dynamicForms,
                and(
                    eq(dynamicForms.programId, programs.id),
                    eq(dynamicForms.isActive, true)
                )
            )
            .where(eq(programs.status, "published"))
            .orderBy(asc(programs.sortOrder));

        const result = programsData.map((row: { program: typeof programs.$inferSelect, formId: string | null }) => ({
            ...row.program,
            form: row.formId ? { id: row.formId } : null,
        }));
        return NextResponse.json(result);
    } catch (error) {
        console.error("Public programs error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
