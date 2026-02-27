import { NextResponse } from "next/server";
import { db } from "@/db";
import { formSubmissions } from "@/db/schema";
import { eq } from "drizzle-orm";

// PUT update submission status
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const update: Record<string, string> = {};
        if (body.status) update.status = body.status;
        if (body.period !== undefined) update.period = body.period;

        await db.update(formSubmissions).set(update).where(eq(formSubmissions.id, id));
        const [submission] = await db.select().from(formSubmissions).where(eq(formSubmissions.id, id));

        return NextResponse.json(submission);
    } catch (error) {
        console.error("Submission PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
