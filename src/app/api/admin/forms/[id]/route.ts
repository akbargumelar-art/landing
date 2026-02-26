import { NextResponse } from "next/server";
import { db } from "@/db";
import { dynamicForms, formFields, programs } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

// GET single form with fields
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const [form] = await db.select().from(dynamicForms).where(eq(dynamicForms.id, id));
        if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const [program] = await db
            .select({ id: programs.id, title: programs.title })
            .from(programs)
            .where(eq(programs.id, form.programId));
        const fields = await db.select().from(formFields).where(eq(formFields.formId, id)).orderBy(asc(formFields.sortOrder));

        return NextResponse.json({ ...form, program: program || null, fields });
    } catch (error) {
        console.error("Form GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PUT update form
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        await db.update(dynamicForms).set({
            title: body.title,
            description: body.description,
            formSchema: body.formSchema,
            isActive: body.isActive,
            programId: body.programId,
        }).where(eq(dynamicForms.id, id));

        const [form] = await db.select().from(dynamicForms).where(eq(dynamicForms.id, id));
        return NextResponse.json(form);
    } catch (error) {
        console.error("Form PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE form
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await db.delete(dynamicForms).where(eq(dynamicForms.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Form DELETE error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
