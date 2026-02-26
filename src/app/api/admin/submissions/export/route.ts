import { NextResponse } from "next/server";
import { db } from "@/db";
import { formSubmissions, submissionValues, formFields, dynamicForms, programs } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import * as XLSX from "xlsx";

// GET export submissions as Excel
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const programId = searchParams.get("programId");

        // Get all submissions
        const allSubmissions = await db.select().from(formSubmissions).orderBy(desc(formSubmissions.submittedAt));

        // Build with relations & filter
        const submissions = [];
        for (const sub of allSubmissions) {
            const [form] = await db.select().from(dynamicForms).where(eq(dynamicForms.id, sub.formId));
            if (!form) continue;
            if (programId && form.programId !== programId) continue;

            const [program] = await db.select({ title: programs.title }).from(programs).where(eq(programs.id, form.programId));
            const fields = await db.select().from(formFields).where(eq(formFields.formId, form.id)).orderBy(asc(formFields.sortOrder));
            const values = await db.select().from(submissionValues).where(eq(submissionValues.submissionId, sub.id));

            submissions.push({
                ...sub,
                form: { ...form, program: program || { title: "Unknown" }, fields },
                values: values.map((v) => ({ ...v, field: fields.find((f) => f.id === v.fieldId) || null })),
            });
        }

        if (submissions.length === 0) {
            return NextResponse.json({ error: "No data to export" }, { status: 404 });
        }

        const fields = submissions[0]?.form.fields || [];
        const headers = ["No", "Program", "Status", "Tanggal", ...fields.map((f) => f.label)];

        const rows = submissions.map((s, i) => {
            const row: Record<string, string | number> = {
                No: i + 1,
                Program: s.form.program.title,
                Status: s.status,
                Tanggal: new Date(s.submittedAt).toLocaleDateString("id-ID"),
            };

            for (const field of fields) {
                const val = s.values.find((v) => v.fieldId === field.id);
                row[field.label] = val?.value || val?.filePath || "";
            }
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data Peserta");
        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="data-peserta-${Date.now()}.xlsx"`,
            },
        });
    } catch (error) {
        console.error("Export error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
