import { NextResponse } from "next/server";
import { db } from "@/db";
import { winners, programs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

interface WinnerRow {
    id: string;
    programId: string;
    submissionId: string;
    name: string;
    phone: string;
    outlet: string;
    period: string;
    photoUrl: string;
    drawnAt: Date;
    program: { title: string };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const programId = searchParams.get("programId");

        let allWinners = await db.select().from(winners).orderBy(desc(winners.drawnAt));

        if (programId) {
            allWinners = allWinners.filter((w) => w.programId === programId);
        }

        const result: WinnerRow[] = [];
        for (const w of allWinners) {
            const [program] = await db
                .select({ title: programs.title })
                .from(programs)
                .where(eq(programs.id, w.programId));

            let finalName = w.name;
            let finalPhone = w.phone;
            let finalOutlet = w.outlet;
            let finalPeriod = w.period;

            // Fallback for old winners without complete details saved
            if (finalName.startsWith("Peserta #") || !finalPeriod || (!finalPhone && !finalOutlet)) {
                try {
                    // Try to get them from submission
                    const { formSubmissions, submissionValues, formFields } = await import("@/db/schema");

                    if (!finalPeriod) {
                        const [sub] = await db.select({ period: formSubmissions.period }).from(formSubmissions).where(eq(formSubmissions.id, w.submissionId));
                        if (sub && sub.period) finalPeriod = sub.period;
                    }

                    // Only query values if name is generic or phone/outlet is missing
                    const values = await db
                        .select({ value: submissionValues.value, label: formFields.label })
                        .from(submissionValues)
                        .innerJoin(formFields, eq(submissionValues.fieldId, formFields.id))
                        .where(eq(submissionValues.submissionId, w.submissionId));

                    if (finalName.startsWith("Peserta #")) {
                        let nameField = values.find((v: any) => v.type === "name");
                        if (!nameField) nameField = values.find((v: any) => v.label && /nama|name/i.test(v.label) && !/phone|email/i.test(v.type));
                        if (!nameField) nameField = values.find((v: any) => /text/i.test(v.type || ""));
                        if (nameField?.value?.trim()) finalName = nameField.value.trim();
                    }
                    if (!finalPhone) {
                        let phoneField = values.find((v: any) => v.type === "phone");
                        if (!phoneField) phoneField = values.find((v: any) => v.label && /telepon|telp|hp|handphone|nomor|wa|whatsapp/i.test(v.label));
                        if (phoneField?.value?.trim()) finalPhone = phoneField.value.trim();
                    }
                    if (!finalOutlet) {
                        const outletField = values.find((v) => /outlet/i.test(v.label));
                        if (outletField?.value) finalOutlet = outletField.value;
                    }
                } catch { /* ignore fallback errors */ }
            }

            result.push({
                ...w,
                name: finalName,
                phone: finalPhone,
                outlet: finalOutlet,
                period: finalPeriod,
                program: program || { title: "Unknown" }
            });
        }

        // Group by period, sorted newest period first
        const grouped: Record<string, WinnerRow[]> = {};
        for (const w of result) {
            const p = w.period || "Tanpa Periode";
            if (!grouped[p]) grouped[p] = [];
            grouped[p].push(w);
        }

        const groupedResult = Object.entries(grouped)
            .map(([period, periodWinners]) => ({ period, winners: periodWinners }))
            .sort((a, b) => b.period.localeCompare(a.period));

        return NextResponse.json(groupedResult);
    } catch (error) {
        console.error("Public winners error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
