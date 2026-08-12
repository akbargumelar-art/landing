import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import * as XLSX from "xlsx";

import { db } from "@/db";
import { mitraKpiTargets, mitraProgramParams, mitraPrograms } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { recomputeKpiResults } from "@/lib/mitra-kpi";
import { listProgramParticipants } from "@/lib/mitra-programs";
import { getClientIp, parseNumber, toDecimalString } from "@/lib/mitra-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadProgram(id: string) {
    const [program] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id)).limit(1);
    return program;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;
    const { id } = await params;
    const program = await loadProgram(id);
    if (!program || program.mechanismType !== "KPI" || program.targetType !== "SALESFORCE") {
        return NextResponse.json({ error: "Program KPI Salesforce tidak ditemukan" }, { status: 404 });
    }

    const [participants, programParams, existing] = await Promise.all([
        listProgramParticipants(id, "SALESFORCE"),
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, id)).orderBy(asc(mitraProgramParams.sortOrder)),
        db.select().from(mitraKpiTargets).where(eq(mitraKpiTargets.programId, id)),
    ]);
    const existingByKey = new Map(existing.map((row) => [`${row.salesforceId}|${row.paramId}`, row.targetValue]));
    const rows = participants.flatMap((participant) => programParams
        .filter((param) => param.kpiCategory !== "NONE")
        .map((param) => ({
            salesforce: participant.name,
            paramKey: param.key,
            targetValue: existingByKey.get(`${participant.id}|${param.id}`) || 0,
        })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ salesforce: "Nama Salesforce", paramKey: "parameter", targetValue: 0 }]), "Target KPI");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="target-kpi-${program.slug}.xlsx"`,
        },
    });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;
    const { id } = await params;
    const program = await loadProgram(id);
    if (!program || program.mechanismType !== "KPI" || program.targetType !== "SALESFORCE") {
        return NextResponse.json({ error: "Program KPI Salesforce tidak ditemukan" }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const mode = String(form.get("mode") || "preview");
    if (!file) return NextResponse.json({ error: "File wajib dipilih" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Maksimal file 5MB" }, { status: 400 });

    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length > 5000) return NextResponse.json({ error: "Maksimal 5.000 baris per berkas" }, { status: 400 });

    const [participants, programParams] = await Promise.all([
        listProgramParticipants(id, "SALESFORCE"),
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, id)),
    ]);
    const sfByName = new Map(participants.map((row) => [row.name.toLowerCase(), row]));
    const paramByKey = new Map(programParams.filter((row) => row.kpiCategory !== "NONE").map((row) => [row.key, row]));
    const errors: { row: number; message: string }[] = [];
    const validRows: { participantKey: string; salesforceId: string; paramId: string; targetValue: number }[] = [];
    const duplicates = new Set<string>();

    rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const salesforce = String(row.salesforce || row.Salesforce || "").trim();
        const paramKey = String(row.paramKey || row.parameter || "").trim();
        const rawTarget = row.targetValue ?? row.target ?? row.nilai;
        const normalizedTarget = typeof rawTarget === "number"
            ? rawTarget
            : Number(String(rawTarget).trim().replace(/\./g, "").replace(",", "."));
        const targetValue = parseNumber(rawTarget);
        const participant = sfByName.get(salesforce.toLowerCase());
        const param = paramByKey.get(paramKey);
        if (!salesforce) return errors.push({ row: rowNumber, message: "Salesforce wajib diisi" });
        if (!participant) return errors.push({ row: rowNumber, message: `Salesforce "${salesforce}" bukan peserta program ini` });
        if (!param) return errors.push({ row: rowNumber, message: `Parameter "${paramKey}" tidak dikenal` });
        if (String(rawTarget).trim() === "" || !Number.isFinite(normalizedTarget) || targetValue < 0) return errors.push({ row: rowNumber, message: "Target harus berupa angka nol atau positif" });
        const key = `${participant.id}|${param.id}`;
        if (duplicates.has(key)) return errors.push({ row: rowNumber, message: "Salesforce dan parameter yang sama muncul lebih dari sekali" });
        duplicates.add(key);
        validRows.push({ participantKey: participant.participantKey, salesforceId: participant.id, paramId: param.id, targetValue });
    });

    if (mode !== "commit" || errors.length > 0) {
        return NextResponse.json({ mode: "preview", rowCount: rows.length, validCount: validRows.length, errors, rows: validRows.slice(0, 20) });
    }

    await db.transaction(async (tx) => {
        for (const row of validRows) {
            const targetValue = toDecimalString(row.targetValue);
            await tx.insert(mitraKpiTargets).values({ id: uuid(), programId: id, ...row, targetValue })
                .onDuplicateKeyUpdate({ set: { targetValue, salesforceId: row.salesforceId } });
        }
    });
    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "IMPORT_KPI_TARGETS",
        entity: "mitra_kpi_target",
        entityId: id,
        diff: { fileName: file.name, rowCount: validRows.length },
        ip: getClientIp(request),
    });
    return NextResponse.json({ success: true, imported: validRows.length });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;
    const { id } = await params;
    const program = await loadProgram(id);
    if (!program) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });
    await db.delete(mitraKpiTargets).where(eq(mitraKpiTargets.programId, id));
    await recomputeKpiResults(id);
    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "RESET_KPI_TARGETS",
        entity: "mitra_program",
        entityId: id,
        ip: getClientIp(request),
    });
    return NextResponse.json({ success: true });
}
