import { NextResponse } from "next/server";
import { db } from "@/db";
import { programs, dynamicForms, formFields } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

// GET single program
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const [program] = await db.select().from(programs).where(eq(programs.id, id));
        if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const forms = await db.select().from(dynamicForms).where(eq(dynamicForms.programId, id));
        const formsWithFields = [];
        for (const form of forms) {
            const fields = await db.select().from(formFields).where(eq(formFields.formId, form.id)).orderBy(asc(formFields.sortOrder));
            formsWithFields.push({ ...form, fields });
        }

        return NextResponse.json({ ...program, forms: formsWithFields });
    } catch (error) {
        console.error("Program GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PUT update program
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        await db.update(programs).set({
            title: body.title,
            description: body.description,
            thumbnail: body.thumbnail,
            category: body.category,
            period: body.period,
            content: body.content,
            terms: body.terms,
            mechanics: body.mechanics,
            gallery: body.gallery,
            prizes: body.prizes,
            status: body.status,
            slug: body.slug,
        }).where(eq(programs.id, id));

        const [program] = await db.select().from(programs).where(eq(programs.id, id));
        return NextResponse.json(program);
    } catch (error) {
        console.error("Program PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE program
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await db.delete(programs).where(eq(programs.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Program DELETE error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
