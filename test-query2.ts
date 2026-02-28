import { db } from "./src/db";
import { formFields, dynamicForms } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
    const forms = await db.select().from(dynamicForms);
    console.log("Forms:", forms.map(f => ({ id: f.id, title: f.title })));

    // get form fields for the first form
    if (forms.length > 0) {
        const fields = await db.select().from(formFields).where(eq(formFields.formId, forms[0].id));
        console.table(fields.map(f => ({ id: f.id, label: f.label, fieldType: f.fieldType, sortOrder: f.sortOrder })));
    }
}
run();
