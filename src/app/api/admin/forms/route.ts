import { NextResponse } from "next/server";
import { db } from "@/db";
import { dynamicForms, formFields, formSubmissions, programs } from "@/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// GET all forms
export async function GET() {
    try {
        const forms = await db.select().from(dynamicForms).orderBy(desc(dynamicForms.createdAt));
        const result = [];
        for (const form of forms) {
            const [program] = await db
                .select({ id: programs.id, title: programs.title })
                .from(programs)
                .where(eq(programs.id, form.programId));
            const fields = await db.select().from(formFields).where(eq(formFields.formId, form.id));
            const [subCount] = await db
                .select({ count: count() })
                .from(formSubmissions)
                .where(eq(formSubmissions.formId, form.id));
            result.push({
                ...form,
                program: program || null,
                fields,
                _count: { submissions: subCount?.count || 0 },
            });
        }
        return NextResponse.json(result);
    } catch (error) {
        console.error("Forms GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST create form
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newId = uuid();
        await db.insert(dynamicForms).values({
            id: newId,
            programId: body.programId,
            title: body.title,
            description: body.description || "",
            isActive: body.isActive ?? true,
            createdAt: new Date(),
        });

        const [form] = await db.select().from(dynamicForms).where(eq(dynamicForms.id, newId));
        return NextResponse.json(form, { status: 201 });
    } catch (error) {
        console.error("Form POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
