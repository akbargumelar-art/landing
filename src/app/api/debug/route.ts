import { NextResponse } from "next/server";
import { db } from "@/db";
import { formSubmissions, submissionValues, formFields, dynamicForms } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
    const subs = await db.select().from(formSubmissions).limit(5);
    const result = [];
    for (const sub of subs) {
        const vals = await db
            .select({ value: submissionValues.value, fieldId: submissionValues.fieldId, label: formFields.label, type: formFields.fieldType })
            .from(submissionValues)
            .leftJoin(formFields, eq(submissionValues.fieldId, formFields.id))
            .where(eq(submissionValues.submissionId, sub.id));
        result.push({ sub, vals });
    }
    return NextResponse.json(result);
}
