import { NextResponse } from "next/server";
import { db } from "@/db";
import { dynamicForms, formFields, formSubmissions, submissionValues } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { sendWhatsAppNotification } from "@/lib/whatsapp";

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
            db.select({ label: formFields.label, type: formFields.fieldType, value: submissionValues.value })
                .from(submissionValues)
                .innerJoin(formFields, eq(submissionValues.fieldId, formFields.id))
                .where(eq(submissionValues.submissionId, submissionId))
        ]).then(async ([subValues]) => {

            // Find Name and Phone with robust matching
            let nameField = subValues.find((v: { label: string | null, type: string | null, value: string }) => v.type === "name");
            if (!nameField) nameField = subValues.find((v: { label: string | null, type: string | null, value: string }) => v.label && /nama|name|lengkap|peserta/i.test(v.label) && !/phone|email|hp|telp/i.test(v.type || "") && !/phone|email|hp|telp|wa/i.test(v.label || ""));
            if (!nameField) nameField = subValues.find((v: { label: string | null, type: string | null, value: string }) => /text/i.test(v.type || "") && !/phone|email|hp|telp|wa/i.test(v.label || ""));

            let phoneField = subValues.find((v: { label: string | null, type: string | null, value: string }) => v.type === "phone");
            if (!phoneField) phoneField = subValues.find((v: { label: string | null, type: string | null, value: string }) => v.label && /telepon|telp|hp|handphone|nomor|wa|whatsapp/i.test(v.label || ""));
            if (!phoneField) phoneField = subValues.find((v: { label: string | null, type: string | null, value: string }) => /number/i.test(v.type || ""));

            const participantPhone = phoneField?.value?.trim();
            const participantName = nameField?.value?.trim() || "Peserta";

            if (!participantPhone) return;

            // Trigger the WAHA service
            await sendWhatsAppNotification(participantPhone, {
                name: participantName,
                programName: form.title || "Program kami"
            });

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
