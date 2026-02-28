import { NextResponse } from "next/server";
import { db } from "@/db";
import { programs, dynamicForms } from "@/db/schema";
import { asc, eq, max } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// GET all programs
export async function GET() {
    try {
        const allPrograms = await db.select().from(programs).orderBy(asc(programs.sortOrder));
        // Attach forms for each program
        const result = [];
        for (const program of allPrograms) {
            const forms = await db
                .select({ id: dynamicForms.id, title: dynamicForms.title, isActive: dynamicForms.isActive })
                .from(dynamicForms)
                .where(eq(dynamicForms.programId, program.id));
            result.push({ ...program, forms });
        }
        return NextResponse.json(result);
    } catch (error) {
        console.error("Programs GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST create program
export async function POST(request: Request) {
    try {
        const body = await request.json();

        let slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const [existing] = await db.select().from(programs).where(eq(programs.slug, slug)).limit(1);
        if (existing) slug = `${slug}-${Date.now()}`;

        const [maxResult] = await db.select({ maxOrder: max(programs.sortOrder) }).from(programs);
        const newId = uuid();

        await db.insert(programs).values({
            id: newId,
            slug,
            title: body.title,
            description: body.description || "",
            thumbnail: body.thumbnail || "",
            category: body.category || "pelanggan",
            period: body.period || "",
            content: body.content || "",
            terms: body.terms || "[]",
            mechanics: body.mechanics || "[]",
            gallery: body.gallery || "[]",
            prizes: body.prizes || "[]",
            status: body.status || "draft",
            sortOrder: (maxResult?.maxOrder ?? -1) + 1,
            createdAt: new Date(),
        });

        const [program] = await db.select().from(programs).where(eq(programs.id, newId));
        return NextResponse.json(program, { status: 201 });
    } catch (error) {
        console.error("Program POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
