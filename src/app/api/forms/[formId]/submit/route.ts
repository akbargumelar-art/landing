import { NextResponse } from "next/server";
import { db } from "@/db";
import { dynamicForms, formFields, formSubmissions, submissionValues, siteSettings } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// POST submit form
export async function POST(
    request: Request,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params;

        // Verify form exists and is active
        const [form] = await db
            .select()
            .from(dynamicForms)
            .where(and(eq(dynamicForms.id, formId), eq(dynamicForms.isActive, true)));

        if (!form) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 });
        }

        const fields = await db
            .select()
            .from(formFields)
            .where(eq(formFields.formId, formId))
            .orderBy(asc(formFields.sortOrder));

        const formData = await request.formData();

        // Validate required fields
        for (const field of fields) {
            if (field.isRequired) {
                const value = formData.get(`field_${field.id}`);
                if (!value || (typeof value === "string" && !value.trim())) {
                    return NextResponse.json(
                        { error: `${field.label} wajib diisi` },
                        { status: 400 }
                    );
                }
            }
        }

        // Create submission
        const submissionId = uuid();
        await db.insert(formSubmissions).values({
            id: submissionId,
            formId,
            status: "pending",
            submittedAt: new Date(),
        });

        // Save field values
        for (const field of fields) {
            const rawValue = formData.get(`field_${field.id}`);
            let value = "";
            let filePath = "";

            if (field.fieldType === "file" && rawValue instanceof File && rawValue.size > 0) {
                const uploadDir = path.join(process.cwd(), "public", "uploads", "submissions");
                await mkdir(uploadDir, { recursive: true });

                const ext = rawValue.name.split(".").pop() || "jpg";
                const filename = `${uuid()}.${ext}`;
                const filepath = path.join(uploadDir, filename);

                const bytes = await rawValue.arrayBuffer();
                await writeFile(filepath, Buffer.from(bytes));

                filePath = `/api/public/uploads/submissions/${filename}`;
                value = rawValue.name;
            } else if (typeof rawValue === "string") {
                value = rawValue;
            }

            await db.insert(submissionValues).values({
                id: uuid(),
                submissionId,
                fieldId: field.id,
                value,
                filePath,
            });
        }

        // --- Trigger WhatsApp Notification (Non-blocking) ---
        // Fire-and-forget: do not await this block so it doesn't slow down the response
        Promise.all([
            db.select().from(siteSettings).limit(1),
            db.select({ label: formFields.label, type: formFields.fieldType, value: submissionValues.value })
                .from(submissionValues)
                .innerJoin(formFields, eq(submissionValues.fieldId, formFields.id))
                .where(eq(submissionValues.submissionId, submissionId))
        ]).then(async ([[settingsRow], subValues]) => {
            if (!settingsRow) return;

            // Parse settings JSON
            const settingsObj: Record<string, string> = {};
            try {
                const arr = JSON.parse(settingsRow.settingsJson || "[]");
                arr.forEach((item: { key: string, value: string }) => {
                    settingsObj[item.key] = item.value;
                });
            } catch {
                return;
            }

            const waUrl = settingsObj.wa_api_url;
            const waToken = settingsObj.wa_api_token;
            let waMsg = settingsObj.wa_template_message;

            if (!waUrl || !waToken || !waMsg) return;

            // Find Name and Phone
            let nameField = subValues.find((v: { label: string | null, type: string | null, value: string }) => v.type === "name");
            if (!nameField) nameField = subValues.find((v: { label: string | null, type: string | null, value: string }) => v.label && /nama|name/i.test(v.label) && !/phone|email/i.test(v.type || ""));
            if (!nameField) nameField = subValues.find((v: { label: string | null, type: string | null, value: string }) => /text/i.test(v.type || ""));

            let phoneField = subValues.find((v: { label: string | null, type: string | null, value: string }) => v.type === "phone");
            if (!phoneField) phoneField = subValues.find((v: { label: string | null, type: string | null, value: string }) => v.label && /telepon|telp|hp|handphone|nomor|wa|whatsapp/i.test(v.label || ""));

            const participantPhone = phoneField?.value?.trim();
            const participantName = nameField?.value?.trim() || "Peserta";

            if (!participantPhone) return;

            // Simple templating: {nama}, {program}
            waMsg = waMsg.replace(/{nama}/g, participantName);
            waMsg = waMsg.replace(/{program}/g, form.title || "Program kami");

            // Format phone number (optional: ensure it starts with country code, logic depends on provider)
            // Example Fonnte Payload: { target: "0812...", message: "...", delay: "2", countryCode: "62" }
            const payload = {
                target: participantPhone,
                message: waMsg,
                delay: "2",
                countryCode: "62" // commonly required for WA gateways
            };

            try {
                await fetch(waUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": waToken // Watzap/Fonnte often use the token in Authorization header
                    },
                    body: JSON.stringify(payload)
                });
                console.log(`WhatsApp Notification queued for ${participantPhone}`);
            } catch (err) {
                console.error("Failed to send WhatsApp notification", err);
            }
        }).catch((err) => {
            console.error("WhatsApp integration block error", err);
        });
        // ----------------------------------------------------

        return NextResponse.json({ success: true, submissionId }, { status: 201 });
    } catch (error) {
        console.error("Form submit error:", error);
        return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
    }
}
