import "dotenv/config";
import { db } from "./src/db";
import { formFields, submissionValues, dynamicForms, formSubmissions } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
    const forms = await db.select({ id: dynamicForms.id, title: dynamicForms.title }).from(dynamicForms);
    console.log("FORMS:", forms);

    const fields = await db.select().from(formFields);
    console.log("FIELDS Count:", fields.length);
    if (fields.length > 0) console.log("First field:", fields[0]);

    const subs = await db.select().from(formSubmissions);
    console.log("SUBMISSIONS Count:", subs.length);
    if (subs.length > 0) console.log("Recent sub:", subs[subs.length - 1]);

    const vals = await db.select().from(submissionValues);
    console.log("VALUES Count:", vals.length);

    process.exit(0);
}

run();
