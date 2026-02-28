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

        let fields = await db
            .select()
            .from(formFields)
            .where(eq(formFields.formId, formId))
            .orderBy(asc(formFields.sortOrder));

        // Self-repair formFields if empty (frontend relies on fallback or unsaved JSON schema)
        if (fields.length === 0) {
            const schemaStr = form.formSchema || "[]";
            let formSchemaObj;
            try {
                formSchemaObj = JSON.parse(schemaStr);
            } catch {
                formSchemaObj = [];
            }

            const elements = formSchemaObj.length > 0 ? formSchemaObj : [
                { id: "nama", type: "text", label: "Nama Lengkap", isRequired: true },
                { id: "nomor", type: "phone", label: "Nomor Telkomsel", isRequired: true },
                { id: "outlet", type: "text", label: "Nama Mitra Outlet", isRequired: true },
                { id: "bukti", type: "file", label: "Bukti Pembelian", isRequired: true },
            ];

            const newFieldsToInsert = [];
            for (let i = 0; i < elements.length; i++) {
                const el = elements[i];
                if (el.type === "heading" || el.type === "paragraph" || el.type === "image" || el.type === "divider") continue;

                newFieldsToInsert.push({
                    id: el.id || uuid(),
                    formId,
                    fieldType: el.type || "text",
                    label: el.label || "",
                    placeholder: el.placeholder || "",
                    hintText: el.hintText || "",
                    isRequired: el.isRequired ?? false,
                    options: JSON.stringify(el.options || []),
                    sortOrder: i,
                });
            }

            if (newFieldsToInsert.length > 0) {
                await db.insert(formFields).values(newFieldsToInsert);
                fields = await db.select().from(formFields).where(eq(formFields.formId, formId)).orderBy(asc(formFields.sortOrder));
            }
        }

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

        // Create variables for denormalization
        let participantName = "Peserta";
        let participantPhone = "-";

        // Pre-parse the names and phones explicitly using user constraints
        for (const field of fields) {
            const rawValue = formData.get(`field_${field.id}`);
            const val = typeof rawValue === "string" ? rawValue.trim() : "";

            if (val) {
                const fLabel = field.label || "";

                // Prioritize checking the official field property type 
                if (field.fieldType === "name") {
                    participantName = val;
                } else if (field.fieldType === "phone") {
                    participantPhone = val;
                } else {
                    // Fallback to strict heuristic checking for older schemas or missing type definitions
                    // but ONLY if we haven't already found the primary ones from `fieldType` above.
                    // This prevents "Nama Outlet" (type 'text') from overwriting a legitimate 'name' field
                    if (/^(nama|name|nama lengkap)$/i.test(fLabel) && participantName === "Peserta") {
                        participantName = val;
                    } else if (/(wa|whatsapp|hp|phone|nomor telp|handphone)/i.test(fLabel) && participantPhone === "-") {
                        participantPhone = val;
                    }
                }
            }
        }

        // Create submission directly embedding denormalized constraints
        const submissionId = uuid();
        await db.insert(formSubmissions).values({
            id: submissionId,
            formId,
            status: "pending",
            participantName,
            participantPhone,
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
        if (participantPhone !== "-") {
            sendWhatsAppNotification(participantPhone, {
                name: participantName,
                programName: form.title || "Program kami"
            }).catch((err) => {
                console.error("WhatsApp integration block error", err);
            });
        }
        // ----------------------------------------------------

        return NextResponse.json({ success: true, submissionId }, { status: 201 });
    } catch (error) {
        console.error("Form submit error:", error);
        return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
    }
}
