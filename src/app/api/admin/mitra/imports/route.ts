import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import * as XLSX from "xlsx";

import { db } from "@/db";
import {
    mitraImportBatches,
    mitraMetricDefs,
    mitraOutletMetrics,
    mitraOutlets,
    mitraProgramParams,
    mitraProgramScores,
    mitraPrograms,
    mitraWhitelistNumbers,
} from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { recomputeMitraProgramLeaderboard } from "@/lib/mitra-data";
import { getClientIp, normalizePhoneE164, toDecimalString } from "@/lib/mitra-utils";
import { normalizeSalesforceName, resolveSalesforceIds } from "@/lib/mitra-salesforce";
import {
    buildOutletMapsUrl,
    normalizeOutletBranding,
    normalizeOutletCategory,
    normalizePjpDay,
    normalizePjpType,
} from "@/lib/mitra-outlet-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportType = "whitelist" | "performance" | "program_score" | "outlet";
type ImportExecutor = Pick<typeof db, "insert">;

export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const batches = await db.select().from(mitraImportBatches).orderBy(mitraImportBatches.createdAt).limit(100);
    return NextResponse.json({ batches: batches.reverse() });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const type = String(form.get("type") || "") as ImportType;
    const mode = String(form.get("mode") || "preview");

    if (!file || !["whitelist", "performance", "program_score", "outlet"].includes(type)) {
        return NextResponse.json({ error: "File dan tipe import wajib dipilih" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Maksimal file import 5MB" }, { status: 400 });
    }

    const rows = parseRows(await file.arrayBuffer()).slice(0, 5000);
    const validation = await validateRows(type, rows);

    if (mode !== "commit" || validation.errors.length > 0) {
        return NextResponse.json({
            type,
            mode: "preview",
            rows: validation.preview,
            errors: validation.errors,
            rowCount: rows.length,
        });
    }

    const batchId = uuid();
    await db.insert(mitraImportBatches).values({
        id: batchId,
        type,
        fileName: file.name,
        rowCount: rows.length,
        status: "PROCESSING",
        previewJson: validation.preview,
        errorLog: [],
        createdBy: auth.session?.userId,
        createdAt: new Date(),
    });

    let touchedProgramIds: string[] = [];
    try {
        await db.transaction(async (tx) => {
            if (type === "whitelist") {
                await commitWhitelistRows(tx, batchId, validation.validRows, auth.session?.userId || null);
            }
            if (type === "performance") {
                await commitPerformanceRows(tx, batchId, validation.validRows);
            }
            if (type === "program_score") {
                touchedProgramIds = await commitProgramScoreRows(tx, batchId, validation.validRows);
            }
            if (type === "outlet") {
                await commitOutletRows(tx, validation.validRows);
            }
        });

        for (const programId of touchedProgramIds) {
            await recomputeMitraProgramLeaderboard(programId);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Import gagal tanpa detail";
        await db.update(mitraImportBatches).set({
            status: "FAILED",
            errorLog: [{ message: message.slice(0, 500) }],
        }).where(eq(mitraImportBatches.id, batchId));
        return NextResponse.json({ error: "Import gagal diproses", batchId }, { status: 500 });
    }

    await db.update(mitraImportBatches).set({ status: "COMPLETED" }).where(eq(mitraImportBatches.id, batchId));
    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "IMPORT",
        entity: `mitra_${type}`,
        entityId: batchId,
        diff: { fileName: file.name, rowCount: rows.length },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, batchId, imported: validation.validRows.length });
}

export async function PATCH(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const batchId = String(body.batchId || "");
    const [batch] = await db.select().from(mitraImportBatches).where(eq(mitraImportBatches.id, batchId)).limit(1);

    if (!batch) return NextResponse.json({ error: "Batch tidak ditemukan" }, { status: 404 });
    if (batch.status === "ROLLED_BACK") return NextResponse.json({ success: true });

    if (batch.type !== "whitelist") {
        return NextResponse.json({ error: "Rollback otomatis saat ini hanya tersedia untuk import whitelist" }, { status: 409 });
    }

    await db.update(mitraWhitelistNumbers).set({ isActive: false }).where(eq(mitraWhitelistNumbers.sourceBatchId, batchId));
    await db.update(mitraImportBatches).set({ status: "ROLLED_BACK", rolledBackAt: new Date() }).where(eq(mitraImportBatches.id, batchId));
    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "ROLLBACK",
        entity: "mitra_import_batch",
        entityId: batchId,
        diff: { type: batch.type },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}

function parseRows(buffer: ArrayBuffer) {
    const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

async function validateRows(type: ImportType, rows: Record<string, unknown>[]) {
    const outlets = await db.select().from(mitraOutlets);
    const metricDefs = await db.select().from(mitraMetricDefs);
    const programs = await db.select().from(mitraPrograms);
    const params = await db.select().from(mitraProgramParams);

    const outletByCode = new Map(outlets.map((outlet) => [outlet.outletCode, outlet]));
    const tapTersedia = new Set(outlets.map((outlet) => (outlet.tap || "").trim().toLowerCase()).filter(Boolean));
    const metricByKey = new Map(metricDefs.map((metric) => [metric.key, metric]));
    const programBySlug = new Map(programs.map((program) => [program.slug, program]));
    const paramByProgramKey = new Map(params.map((param) => [`${param.programId}:${param.key}`, param]));

    const errors: { row: number; message: string }[] = [];
    const validRows: Record<string, unknown>[] = [];

    rows.forEach((row, index) => {
        const rowNum = index + 2;

        if (type === "whitelist") {
            const phone = normalizePhoneE164(String(row.phone || row.nomor || row.phoneE164 || ""));
            const scope = String(row.scope || "ALL").toUpperCase();
            const outletCode = String(row.outletCode || row.kodeOutlet || "");
            // Scope wilayah diganti TAP; nilainya dicocokkan ke daftar TAP yang benar-benar
            // dipakai outlet, bukan ke tabel master tersendiri.
            const tap = String(row.tap || "").trim();
            const outlet = outletCode ? outletByCode.get(outletCode) : null;

            if (!phone) errors.push({ row: rowNum, message: "Nomor wajib diisi" });
            else if (!["ALL", "OUTLET", "TAP"].includes(scope)) errors.push({ row: rowNum, message: "Scope tidak valid" });
            else if (scope === "OUTLET" && !outlet) errors.push({ row: rowNum, message: "Outlet tidak ditemukan" });
            else if (scope === "TAP" && !tapTersedia.has(tap.toLowerCase())) errors.push({ row: rowNum, message: "TAP tidak ditemukan pada data outlet" });
            else validRows.push({ ...row, phoneE164: phone, scope, outletId: outlet?.id || null, tap: scope === "TAP" ? tap : null });
        }

        if (type === "performance") {
            const outlet = outletByCode.get(String(row.outletCode || row.kodeOutlet || ""));
            const metric = metricByKey.get(String(row.metricKey || row.metric || ""));
            const periodYm = String(row.periodYm || row.periode || "");
            if (!outlet) errors.push({ row: rowNum, message: "Outlet tidak ditemukan" });
            else if (!metric) errors.push({ row: rowNum, message: "Metric tidak ditemukan" });
            else if (!/^\d{4}-\d{2}$/.test(periodYm)) errors.push({ row: rowNum, message: "Periode harus YYYY-MM" });
            else validRows.push({ ...row, outletId: outlet.id, metricDefId: metric.id, periodYm });
        }

        if (type === "program_score") {
            const outlet = outletByCode.get(String(row.outletCode || row.kodeOutlet || ""));
            const program = programBySlug.get(String(row.programSlug || row.program || ""));
            const param = program ? paramByProgramKey.get(`${program.id}:${String(row.paramKey || row.parameter || "")}`) : null;
            const periodYm = String(row.periodYm || row.periode || "");
            if (!outlet) errors.push({ row: rowNum, message: "Outlet tidak ditemukan" });
            else if (!program) errors.push({ row: rowNum, message: "Program tidak ditemukan" });
            else if (!param) errors.push({ row: rowNum, message: "Parameter program tidak ditemukan" });
            else if (!/^\d{4}-\d{2}$/.test(periodYm)) errors.push({ row: rowNum, message: "Periode harus YYYY-MM" });
            else validRows.push({ ...row, outletId: outlet.id, programId: program.id, paramId: param.id, periodYm });
        }

        if (type === "outlet") {
            const outletCode = String(row.outletCode || row.kodeOutlet || "").trim();
            const name = String(row.name || row.nama || "").trim();
            const phone = normalizePhoneE164(String(row.ownerPhone || row.nomorHp || ""));
            const kabupaten = String(row.kabupaten || "").trim();

            if (!/^\d{10}$/.test(outletCode)) errors.push({ row: rowNum, message: "Kode Outlet wajib diisi 10 digit angka" });
            else if (outletByCode.has(outletCode)) errors.push({ row: rowNum, message: "Kode Outlet sudah ada" });
            else if (!name) errors.push({ row: rowNum, message: "Nama Outlet wajib diisi" });
            else if (!phone) errors.push({ row: rowNum, message: "Nomor HP wajib diisi" });
            else if (!kabupaten) errors.push({ row: rowNum, message: "Kabupaten wajib diisi" });
            else validRows.push({
                ...row,
                outletCode,
                name,
                ownerPhone: phone,
                territoryId: null,
                rsNumber: String(row.rsNumber || ""),
                ownerName: String(row.ownerName || ""),
                tap: String(row.tap || ""),
                salesforce: String(row.salesforce || ""),
                kabupaten,
                kecamatan: String(row.kecamatan || ""),
                latitude: row.latitude ? parseFloat(String(row.latitude)) : null,
                longitude: row.longitude ? parseFloat(String(row.longitude)) : null,
                category: row.category,
                pjpDay: row.pjpDay,
                pjpType: row.pjpType,
                branding: row.branding,
            });
        }
    });

    return {
        errors,
        validRows,
        preview: validRows.slice(0, 20),
    };
}

async function commitWhitelistRows(executor: ImportExecutor, batchId: string, rows: Record<string, unknown>[], userId: string | null) {
    if (rows.length === 0) return;
    await executor.insert(mitraWhitelistNumbers).values(rows.map((row) => ({
        id: uuid(),
        phoneE164: String(row.phoneE164),
        name: row.name ? String(row.name) : null,
        scope: row.scope as "ALL" | "OUTLET" | "TAP",
        outletId: row.outletId ? String(row.outletId) : null,
        tap: row.tap ? String(row.tap) : null,
        keterangan: row.keterangan ? String(row.keterangan) : null,
        isActive: true,
        createdBy: userId,
        sourceBatchId: batchId,
        expiresAt: row.expiresAt ? new Date(String(row.expiresAt)) : null,
        createdAt: new Date(),
    })));
}

async function commitPerformanceRows(executor: ImportExecutor, batchId: string, rows: Record<string, unknown>[]) {
    for (const row of rows) {
        await executor.insert(mitraOutletMetrics).values({
            id: uuid(),
            outletId: String(row.outletId),
            metricDefId: String(row.metricDefId),
            periodYm: String(row.periodYm),
            value: toDecimalString(row.value || row.nilai || 0),
            sourceBatchId: batchId,
            createdAt: new Date(),
        }).onDuplicateKeyUpdate({
            set: {
                value: toDecimalString(row.value || row.nilai || 0),
                sourceBatchId: batchId,
            },
        });
    }
}

async function commitProgramScoreRows(executor: ImportExecutor, batchId: string, rows: Record<string, unknown>[]) {
    const touchedProgramIds = new Set<string>();

    for (const row of rows) {
        const programId = String(row.programId);
        touchedProgramIds.add(programId);
        await executor.insert(mitraProgramScores).values({
            id: uuid(),
            programId,
            outletId: String(row.outletId),
            paramId: String(row.paramId),
            rawValue: toDecimalString(row.rawValue || row.value || 0),
            points: toDecimalString(row.points || row.rawValue || row.value || 0),
            periodYm: String(row.periodYm),
            batchId,
        }).onDuplicateKeyUpdate({
            set: {
                rawValue: toDecimalString(row.rawValue || row.value || 0),
                points: toDecimalString(row.points || row.rawValue || row.value || 0),
                batchId,
            },
        });
    }

    return Array.from(touchedProgramIds);
}

async function commitOutletRows(executor: ImportExecutor, rows: Record<string, unknown>[]) {
    if (rows.length === 0) return;
    // Nama salesforce di file hanya teks, jadi diterjemahkan lebih dulu menjadi id master
    // (dibuatkan bila belum ada) supaya satu nama tidak tersimpan berulang di tiap outlet.
    const salesforceIds = await resolveSalesforceIds(rows.map((row) => row.salesforce));
    const values = rows.map((row) => {
        const latitude = typeof row.latitude === "number" ? row.latitude : null;
        const longitude = typeof row.longitude === "number" ? row.longitude : null;
        return {
            id: uuid(),
            outletCode: String(row.outletCode),
            publicToken: uuid().replace(/-/g, "").slice(0, 16),
            name: String(row.name),
            ownerPhone: String(row.ownerPhone),
            territoryId: row.territoryId ? String(row.territoryId) : null,
            rsNumber: String(row.rsNumber || ""),
            ownerName: String(row.ownerName || ""),
            tap: String(row.tap || ""),
            salesforceId: salesforceIds.get(normalizeSalesforceName(row.salesforce).toLowerCase()) || null,
            kabupaten: String(row.kabupaten || ""),
            kecamatan: String(row.kecamatan || ""),
            latitude,
            longitude,
            locationUrl: buildOutletMapsUrl(latitude, longitude) || null,
            // Sel yang kosong atau tidak dikenal jatuh ke default, supaya satu nilai keliru
            // tidak menggagalkan seluruh baris import.
            category: normalizeOutletCategory(row.category),
            pjpDay: normalizePjpDay(row.pjpDay),
            pjpType: normalizePjpType(row.pjpType),
            branding: normalizeOutletBranding(row.branding),
            status: "ACTIVE" as const,
            createdAt: new Date(),
        };
    });
    await executor.insert(mitraOutlets).values(values);
}
