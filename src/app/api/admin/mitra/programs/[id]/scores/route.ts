import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import * as XLSX from "xlsx";

import { db } from "@/db";
import {
    mitraImportBatches,
    mitraKpiOutletScores,
    mitraOutlets,
    mitraProgramParams,
    mitraProgramScores,
    mitraPrograms,
} from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { recomputeKpiResults } from "@/lib/mitra-kpi";
import {
    listProgramParticipants,
    participantColumns,
    recomputeProgramLeaderboard,
    type ProgramTargetType,
} from "@/lib/mitra-programs";
import { getClientIp, parseNumber, toDecimalString } from "@/lib/mitra-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDateOnly(nilai: Date | string): string {
    const tanggal = nilai instanceof Date ? nilai : new Date(nilai);
    return tanggal.toISOString().slice(0, 10);
}

/**
 * Excel menyimpan tanggal sebagai angka serial, sedangkan CSV mengirimnya sebagai teks.
 * Keduanya diseragamkan ke YYYY-MM-DD supaya kolom tanggal di database menerima satu
 * bentuk saja.
 */
function normalizeAchievementDate(nilai: unknown): string {
    if (typeof nilai === "number" && Number.isFinite(nilai)) {
        const parsed = XLSX.SSF.parse_date_code(nilai);
        if (!parsed) return "";
        const pad = (angka: number) => String(angka).padStart(2, "0");
        return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
    }

    const teks = String(nilai ?? "").trim();
    if (!teks) return "";
    // Bentuk d/m/yyyy sering muncul dari Excel berlokal Indonesia.
    const slash = teks.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
        const [, hari, bulan, tahun] = slash;
        return `${tahun}-${bulan.padStart(2, "0")}-${hari.padStart(2, "0")}`;
    }
    return teks.slice(0, 10);
}

/** Template unduhan: kolomnya sudah menyesuaikan jenis peserta dan parameter program. */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const [program] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id)).limit(1);
    if (!program) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });
    if (program.mechanismType === "KPI") return getKpiTemplate(program);

    const targetType = program.targetType as ProgramTargetType;
    const [programParams, peserta] = await Promise.all([
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, id)).orderBy(asc(mitraProgramParams.sortOrder)),
        listProgramParticipants(id, targetType),
    ]);

    const kolomKode = targetType === "SALESFORCE" ? "salesforce" : "outletCode";
    const tanggalContoh = toDateOnly(program.periodStart);

    /**
     * Baris contoh dibuat dari peserta dan parameter program itu sendiri, bukan nilai
     * karangan -- pengisi jadi bisa langsung menimpa angkanya tanpa menebak kode apa pun.
     */
    const contoh = peserta.slice(0, 3).flatMap((item) =>
        programParams.map((param) => ({
            [kolomKode]: item.code,
            paramKey: param.key,
            achievementDate: tanggalContoh,
            rawValue: 0,
        }))
    );

    const rows = contoh.length > 0 ? contoh : [{
        [kolomKode]: targetType === "SALESFORCE" ? "Nama Salesforce" : "2201055482",
        paramKey: programParams[0]?.key || "parameter",
        achievementDate: tanggalContoh,
        rawValue: 0,
    }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Pencapaian");

    if (programParams.length > 0) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
            programParams.map((param) => ({
                paramKey: param.key,
                Parameter: param.label,
                Satuan: param.unit || "",
                Bobot: param.isScored ? param.weight : "-",
                Agregasi: param.aggregation,
                Dinilai: param.isScored ? "Ya" : "Tidak (informasi saja)",
            }))
        ), "Parameter");
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="pencapaian-${program.slug}.xlsx"`,
        },
    });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const [program] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id)).limit(1);
    if (!program) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });
    if (program.mechanismType === "KPI") return postKpiScores(request, program, auth.session?.userId);

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const mode = String(form.get("mode") || "preview");

    if (!file) return NextResponse.json({ error: "File wajib dipilih" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Maksimal file 5MB" }, { status: 400 });

    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }).slice(0, 5000);

    const targetType = program.targetType as ProgramTargetType;
    const [programParams, peserta] = await Promise.all([
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, id)),
        listProgramParticipants(id, targetType),
    ]);

    const paramByKey = new Map(programParams.map((param) => [param.key, param]));
    const pesertaByCode = new Map(peserta.map((item) => [item.code, item]));
    const mulai = toDateOnly(program.periodStart);
    const selesai = toDateOnly(program.periodEnd);

    const errors: { row: number; message: string }[] = [];
    const validRows: {
        participantKey: string;
        participantId: string;
        paramId: string;
        weight: number;
        rawValue: number;
        achievementDate: string;
    }[] = [];
    const kunciDipakai = new Set<string>();

    rows.forEach((row, index) => {
        const rowNum = index + 2;
        const kode = String(row.outletCode || row.salesforce || row.kode || row.peserta || "").trim();
        const paramKey = String(row.paramKey || row.parameter || "").trim();
        const achievementDate = normalizeAchievementDate(row.achievementDate || row.tanggal);

        const info = pesertaByCode.get(kode);
        const param = paramByKey.get(paramKey);

        if (!kode) return errors.push({ row: rowNum, message: "Kode peserta wajib diisi" });
        if (!info) return errors.push({ row: rowNum, message: `Peserta "${kode}" belum terdaftar pada program ini` });
        if (!param) return errors.push({ row: rowNum, message: `Parameter "${paramKey}" tidak dikenal` });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(achievementDate) || Number.isNaN(new Date(achievementDate).getTime())) {
            return errors.push({ row: rowNum, message: "Tanggal pencapaian harus YYYY-MM-DD" });
        }
        if (achievementDate < mulai || achievementDate > selesai) {
            return errors.push({ row: rowNum, message: "Tanggal di luar periode program" });
        }

        // Baris kembar di dalam SATU berkas ditolak: bila satu peserta/parameter/tanggal
        // muncul dua kali dengan angka berbeda, tidak ada jawaban yang benar soal mana
        // yang menang, dan memilih diam-diam akan menyimpan angka yang tak pernah diperiksa.
        const kunci = `${info.participantKey}|${param.id}|${achievementDate}`;
        if (kunciDipakai.has(kunci)) {
            return errors.push({ row: rowNum, message: "Peserta, parameter, dan tanggal yang sama muncul lebih dari sekali di berkas ini" });
        }
        kunciDipakai.add(kunci);

        validRows.push({
            participantKey: info.participantKey,
            participantId: info.id,
            paramId: param.id,
            // Parameter informasi tidak berpoin: nilainya tetap tersimpan dan tampil di
            // tabel, tetapi tidak boleh menggeser peringkat siapa pun.
            weight: param.isScored ? (Number(param.weight) || 1) : 0,
            rawValue: parseNumber(row.rawValue ?? row.nilai ?? row.value),
            achievementDate,
        });
    });

    if (mode !== "commit" || errors.length > 0) {
        return NextResponse.json({
            mode: "preview",
            rowCount: rows.length,
            validCount: validRows.length,
            errors,
            rows: validRows.slice(0, 20),
        });
    }

    const batchId = uuid();
    await db.insert(mitraImportBatches).values({
        id: batchId,
        type: "program_score",
        fileName: file.name,
        rowCount: rows.length,
        status: "PROCESSING",
        previewJson: validRows.slice(0, 20),
        errorLog: [],
        createdBy: auth.session?.userId,
        createdAt: new Date(),
    });

    try {
        await db.transaction(async (tx) => {
            for (const row of validRows) {
                // Poin dihitung server-side dari nilai mentah x bobot parameter; pengunggah
                // cukup mengisi angka pencapaian apa adanya.
                const points = toDecimalString(row.rawValue * row.weight);
                const rawValue = toDecimalString(row.rawValue);

                await tx.insert(mitraProgramScores).values({
                    id: uuid(),
                    programId: id,
                    ...participantColumns(targetType, row.participantId),
                    paramId: row.paramId,
                    rawValue,
                    points,
                    achievementDate: row.achievementDate,
                    batchId,
                }).onDuplicateKeyUpdate({ set: { rawValue, points, batchId } });
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upload gagal tanpa detail";
        await db.update(mitraImportBatches)
            .set({ status: "FAILED", errorLog: [{ message: message.slice(0, 500) }] })
            .where(eq(mitraImportBatches.id, batchId));
        return NextResponse.json({ error: "Upload gagal diproses", batchId }, { status: 500 });
    }

    await db.update(mitraImportBatches).set({ status: "COMPLETED" }).where(eq(mitraImportBatches.id, batchId));
    await recomputeProgramLeaderboard(id);
    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "IMPORT",
        entity: "mitra_program_score",
        entityId: id,
        diff: { fileName: file.name, rowCount: validRows.length },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, imported: validRows.length, batchId });
}

/** Menghapus seluruh pencapaian program, untuk mengulang dari berkas yang benar. */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const [program] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id)).limit(1);
    if (!program) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });
    if (program.mechanismType === "KPI") {
        await db.delete(mitraKpiOutletScores).where(eq(mitraKpiOutletScores.programId, id));
        await recomputeKpiResults(id);
        await writeAdminAuditLog({
            userId: auth.session?.userId,
            action: "RESET_KPI_SCORES",
            entity: "mitra_program",
            entityId: id,
            ip: getClientIp(request),
        });
        return NextResponse.json({ success: true });
    }

    await db.delete(mitraProgramScores).where(eq(mitraProgramScores.programId, id));
    await recomputeProgramLeaderboard(id);
    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "RESET_SCORES",
        entity: "mitra_program",
        entityId: id,
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}

async function getKpiTemplate(program: typeof mitraPrograms.$inferSelect) {
    const [programParams, participants] = await Promise.all([
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, program.id)).orderBy(asc(mitraProgramParams.sortOrder)),
        listProgramParticipants(program.id, "SALESFORCE"),
    ]);
    const sfIds = participants.map((row) => row.id);
    const outlets = sfIds.length > 0
        ? await db.select({ code: mitraOutlets.outletCode, name: mitraOutlets.name, salesforceId: mitraOutlets.salesforceId })
            .from(mitraOutlets).where(inArray(mitraOutlets.salesforceId, sfIds))
        : [];
    const sfNameById = new Map(participants.map((row) => [row.id, row.name]));
    const date = toDateOnly(program.periodStart);
    const rows = outlets.slice(0, 3).flatMap((outlet) => programParams
        .filter((param) => param.kpiCategory !== "NONE")
        .map((param) => ({
            outletCode: outlet.code,
            outletName: outlet.name,
            salesforce: outlet.salesforceId ? sfNameById.get(outlet.salesforceId) || "" : "",
            paramKey: param.key,
            achievementDate: date,
            rawValue: 0,
        })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ outletCode: "2201055482", paramKey: programParams[0]?.key || "parameter", achievementDate: date, rawValue: 0 }]), "Pencapaian KPI");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(programParams.map((param) => ({
        paramKey: param.key,
        Parameter: param.label,
        Kategori: param.kpiCategory,
        Bobot: param.weight,
        Agregasi: param.aggregation,
        Cap: param.achievementCap || "Tanpa batas",
        Polaritas: param.polarity,
    }))), "Parameter");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="pencapaian-kpi-${program.slug}.xlsx"`,
        },
    });
}

async function postKpiScores(request: Request, program: typeof mitraPrograms.$inferSelect, userId?: string) {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const mode = String(form.get("mode") || "preview");
    if (!file) return NextResponse.json({ error: "File wajib dipilih" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Maksimal file 5MB" }, { status: 400 });
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length > 5000) return NextResponse.json({ error: "Maksimal 5.000 baris per berkas" }, { status: 400 });

    const [programParams, participants] = await Promise.all([
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, program.id)),
        listProgramParticipants(program.id, "SALESFORCE"),
    ]);
    const sfIds = participants.map((row) => row.id);
    const outlets = sfIds.length > 0
        ? await db.select({ id: mitraOutlets.id, code: mitraOutlets.outletCode, salesforceId: mitraOutlets.salesforceId })
            .from(mitraOutlets).where(inArray(mitraOutlets.salesforceId, sfIds))
        : [];
    const outletByCode = new Map(outlets.map((row) => [row.code, row]));
    const participantIds = new Set(sfIds);
    const paramByKey = new Map(programParams.filter((row) => row.kpiCategory !== "NONE").map((row) => [row.key, row]));
    const start = toDateOnly(program.periodStart);
    const end = toDateOnly(program.periodEnd);
    const errors: { row: number; message: string }[] = [];
    const validRows: { outletId: string; salesforceId: string; paramId: string; rawValue: number; achievementDate: string }[] = [];
    const duplicates = new Set<string>();

    rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const code = String(row.outletCode || row.kode || "").trim();
        const paramKey = String(row.paramKey || row.parameter || "").trim();
        const achievementDate = normalizeAchievementDate(row.achievementDate || row.tanggal);
        const outlet = outletByCode.get(code);
        const param = paramByKey.get(paramKey);
        if (!code) return errors.push({ row: rowNumber, message: "Kode outlet wajib diisi" });
        if (!outlet) return errors.push({ row: rowNumber, message: `Outlet "${code}" tidak ditemukan atau Salesforce pembinanya bukan peserta program` });
        if (!outlet.salesforceId || !participantIds.has(outlet.salesforceId)) return errors.push({ row: rowNumber, message: `Salesforce outlet "${code}" bukan peserta program ini` });
        if (!param) return errors.push({ row: rowNumber, message: `Parameter "${paramKey}" tidak dikenal` });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(achievementDate) || Number.isNaN(new Date(achievementDate).getTime())) return errors.push({ row: rowNumber, message: "Tanggal pencapaian harus YYYY-MM-DD" });
        if (achievementDate < start || achievementDate > end) return errors.push({ row: rowNumber, message: "Tanggal di luar periode program" });
        const key = `${outlet.id}|${param.id}|${achievementDate}`;
        if (duplicates.has(key)) return errors.push({ row: rowNumber, message: "Outlet, parameter, dan tanggal yang sama muncul lebih dari sekali" });
        duplicates.add(key);
        validRows.push({ outletId: outlet.id, salesforceId: outlet.salesforceId, paramId: param.id, rawValue: parseNumber(row.rawValue ?? row.nilai ?? row.value), achievementDate });
    });

    if (mode !== "commit" || errors.length > 0) {
        return NextResponse.json({ mode: "preview", rowCount: rows.length, validCount: validRows.length, errors, rows: validRows.slice(0, 20) });
    }

    const batchId = uuid();
    await db.insert(mitraImportBatches).values({
        id: batchId,
        type: "kpi_outlet_score",
        fileName: file.name,
        rowCount: rows.length,
        status: "PROCESSING",
        previewJson: validRows.slice(0, 20),
        errorLog: [],
        createdBy: userId,
        createdAt: new Date(),
    });
    try {
        await db.transaction(async (tx) => {
            for (const row of validRows) {
                const rawValue = toDecimalString(row.rawValue);
                await tx.insert(mitraKpiOutletScores).values({ id: uuid(), programId: program.id, ...row, rawValue, batchId })
                    .onDuplicateKeyUpdate({ set: { rawValue, salesforceId: row.salesforceId, batchId } });
            }
        });
        await db.update(mitraImportBatches).set({ status: "COMPLETED" }).where(eq(mitraImportBatches.id, batchId));
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upload gagal tanpa detail";
        await db.update(mitraImportBatches).set({ status: "FAILED", errorLog: [{ message: message.slice(0, 500) }] }).where(eq(mitraImportBatches.id, batchId));
        return NextResponse.json({ error: "Upload gagal diproses", batchId }, { status: 500 });
    }
    const recompute = await recomputeKpiResults(program.id);
    await writeAdminAuditLog({
        userId,
        action: "IMPORT_KPI_SCORES",
        entity: "mitra_kpi_outlet_score",
        entityId: program.id,
        diff: { fileName: file.name, rowCount: validRows.length },
        ip: getClientIp(request),
    });
    return NextResponse.json({ success: true, imported: validRows.length, batchId, ...recompute });
}
