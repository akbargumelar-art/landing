import { NextResponse } from "next/server";
import { db } from "@/db";
import { dynamicForms, formFields, programs } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";

// GET form schema for public rendering
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params;

        const [form] = await db
            .select()
            .from(dynamicForms)
            .where(and(eq(dynamicForms.id, formId), eq(dynamicForms.isActive, true)));

        if (!form) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 });
        }

        const [program] = await db
            .select({ id: programs.id, title: programs.title, slug: programs.slug })
            .from(programs)
            .where(eq(programs.id, form.programId));

        const fields = await db
            .select({
                id: formFields.id,
                type: formFields.fieldType,
                fieldType: formFields.fieldType,
                label: formFields.label,
                placeholder: formFields.placeholder,
                content: formFields.placeholder, // Re-map back
                isRequired: formFields.isRequired,
                options: formFields.options,
                sortOrder: formFields.sortOrder,
            })
            .from(formFields)
            .where(eq(formFields.formId, formId))
            .orderBy(asc(formFields.sortOrder));

        return NextResponse.json({ ...form, program: program || null, fields });
    } catch (error) {
        console.error("Form GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
