import { db } from "./src/db";
import { formFields, submissionValues, formSubmissions } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    const subs = await db.select().from(formSubmissions).limit(5);
    console.log("Submissions:", subs);

    for (const sub of subs) {
        const values = await db
            .select({
                label: formFields.label,
                type: formFields.fieldType,
                value: submissionValues.value
            })
            .from(submissionValues)
            .innerJoin(formFields, eq(submissionValues.fieldId, formFields.id))
            .where(eq(submissionValues.submissionId, sub.id));
        console.log(`Sub ${sub.id} values:`, values);
    }
    process.exit(0);
}
main().catch(console.error);
