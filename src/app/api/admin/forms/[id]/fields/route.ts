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

        // Instead of wiping all fields (which cascade-deletes submission data),
        // we will find which fields to delete, update, or insert.
        const existingFieldsMap = await db.select({ id: formFields.id }).from(formFields).where(eq(formFields.formId, formId));
        const existingIds = existingFieldsMap.map((f: { id: string }) => f.id);
        const newIds = fields.map((f: { id?: string }) => f.id).filter(Boolean);

        const idsToDelete = existingIds.filter((id: string) => !newIds.includes(id));

        // 1. Delete removed fields
        if (idsToDelete.length > 0) {
            for (const delId of idsToDelete) {
                await db.delete(formFields).where(eq(formFields.id, delId));
            }
        }

        // 2. Upsert (Update or Insert) fields in order
        let sortIndex = 0;
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];

            // Do NOT save static layout components to the database mapped columns
            // since they are only used for UI rendering and don't accept input.
            // (They are already saved in formSchema on the Form object)
            if (["heading", "paragraph", "image", "divider"].includes(field.type)) {
                continue;
            }

            // We use the JSON element's string ID or auto-generate if missing
            const fieldId = field.id || uuid();
            const isExisting = existingIds.includes(fieldId);

            const fieldValues = {
                formId,
                fieldType: field.type || "text",
                label: field.label || "",
                placeholder: field.content || field.placeholder || "",
                hintText: field.hintText || "",
                isRequired: field.isRequired ?? false,
                options: Array.isArray(field.options) ? JSON.stringify(field.options) : (field.options || "[]"),
                sortOrder: sortIndex++,
            };

            if (isExisting) {
                await db.update(formFields).set(fieldValues).where(eq(formFields.id, fieldId));
            } else {
                await db.insert(formFields).values({ id: fieldId, ...fieldValues });
            }
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
