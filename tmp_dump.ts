// tmp/dump_submissions.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { formSubmissions, submissionValues, formFields } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    const connection = await mysql.createConnection({
        uri: process.env.DATABASE_URL as string,
    });
    const db = drizzle(connection);

    // Get the top 5 submissions
    const subs = await db.select().from(formSubmissions).limit(5);

    for (const sub of subs) {
        console.log(`\nSubmission: ${sub.id}`);
        // get values
        const vals = await db
            .select({ value: submissionValues.value, fieldId: submissionValues.fieldId, label: formFields.label, type: formFields.fieldType })
            .from(submissionValues)
            .leftJoin(formFields, eq(submissionValues.fieldId, formFields.id))
            .where(eq(submissionValues.submissionId, sub.id));

        console.log("Values:", vals);
    }

    await connection.end();
}

main().catch(console.error);
