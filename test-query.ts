import "dotenv/config";
import { db } from "./src/db";
import { formSubmissions, submissionValues, formFields } from "./src/db/schema";
import { eq, desc } from "drizzle-orm";

async function run() {
    const subs = await db.query.formSubmissions.findMany({
        with: {
            submissionValues: {
                with: {
                    field: true,
                },
            },
            form: {
                with: {
                    fields: true,
                }
            }
        },
        orderBy: [desc(formSubmissions.submittedAt)],
        limit: 1,
    });

    console.log("LATEST SUBMISSION:");
    console.log(JSON.stringify(subs[0], null, 2));

    process.exit(0);
}

run();
