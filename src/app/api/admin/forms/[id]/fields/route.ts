import { NextResponse } from "next/server";
import { db } from "@/db";
import { formFields, dynamicForms } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// PUT batch update fields (create/update/delete/reorder)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: formId } = await params;
        const body = await request.json();
        const { fields } = body;

        // Delete existing fields
        await db.delete(formFields).where(eq(formFields.formId, formId));

        // Create new fields in order
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            await db.insert(formFields).values({
                id: field.id || uuid(),
                formId,
                fieldType: field.fieldType,
                label: field.label,
                placeholder: field.placeholder || "",
                hintText: field.hintText || "",
                isRequired: field.isRequired ?? false,
                options: field.options || "[]",
                sortOrder: i,
            });
        }

        // Return updated form with fields
        const [form] = await db.select().from(dynamicForms).where(eq(dynamicForms.id, formId));
        const updatedFields = await db.select().from(formFields).where(eq(formFields.formId, formId)).orderBy(asc(formFields.sortOrder));

        return NextResponse.json({ ...form, fields: updatedFields });
    } catch (error) {
        console.error("Fields PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
