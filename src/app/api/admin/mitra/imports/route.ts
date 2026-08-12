import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import * as XLSX from "xlsx";

import { db } from "@/db";
import {
    mitraImportBatches,
    mitraMetricDefs,
    mitraOutletDetails,
    mitraOutletMetrics,
    mitraOutlets,
    mitraWhitelistNumbers,
} from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp, normalizePhoneE164, toDecimalString } from "@/lib/mitra-utils";
import { normalizeSalesforceName, resolveSalesforceIds } from "@/lib/mitra-salesforce";
import { MITRA_DETAIL_FIELD_GROUPS, sanitizeDetailGroup } from "@/lib/mitra-fields";
import {
    buildOutletMapsUrl,
    normalizeOutletBranding,
    normalizeOutletCategory,
    normalizePjpDay,
    normalizePjpType,
} from "@/lib/mitra-outlet-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportType = "whitelist" | "performance" | "outlet" | "outlet_detail";
// select dan update ikut dipakai jalur outlet_detail, yang menggabungkan nilai baru
// dengan yang sudah tersimpan alih-alih menimpanya.
type ImportExecutor = Pick<typeof db, "insert" | "select" | "update">;

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

    // Daftar ini diturunkan dari ImportType, bukan ditulis ulang sebagai literal: versi
    // sebelumnya kelewat mencantumkan "outlet_detail", sehingga pilihan "Detail Outlet" di
    // layar Upload Data selalu ditolak 400 padahal validasi dan commit-nya sudah ada.
    const TIPE_DIDUKUNG: ImportType[] = ["whitelist", "performance", "outlet", "outlet_detail"];

    if (!file || !TIPE_DIDUKUNG.includes(type)) {
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
            ringkasan: validation.ringkasan,
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

    try {
        await db.transaction(async (tx) => {
            if (type === "whitelist") {
                await commitWhitelistRows(tx, batchId, validation.validRows, auth.session?.userId || null);
            }
            if (type === "performance") {
                await commitPerformanceRows(tx, batchId, validation.validRows);
            }
            if (type === "outlet") {
                await commitOutletRows(tx, validation.validRows);
            }
            if (type === "outlet_detail") {
                await commitOutletDetailRows(tx, validation.validRows);
            }
        });

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

    return NextResponse.json({
        success: true,
        batchId,
        imported: validation.validRows.length,
        ringkasan: validation.ringkasan,
    });
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

function teksKolom(nilai: unknown): string {
    return nilai === null || nilai === undefined ? "" : String(nilai).trim();
}

/** Angka yang benar-benar terisi. Sel kosong menghasilkan null, bukan 0. */
function angkaKolom(nilai: unknown): number | null {
    const teks = teksKolom(nilai);
    if (!teks) return null;
    const angka = parseFloat(teks);
    return Number.isFinite(angka) ? angka : null;
}

async function validateRows(type: ImportType, rows: Record<string, unknown>[]) {
    const outlets = await db.select().from(mitraOutlets);
    const metricDefs = await db.select().from(mitraMetricDefs);

    const outletByCode = new Map(outlets.map((outlet) => [outlet.outletCode, outlet]));
    const tapTersedia = new Set(outlets.map((outlet) => (outlet.tap || "").trim().toLowerCase()).filter(Boolean));
    const metricByKey = new Map(metricDefs.map((metric) => [metric.key, metric]));

    const errors: { row: number; message: string }[] = [];
    const validRows: Record<string, unknown>[] = [];

    /**
     * Kunci baris yang sudah dipakai DI DALAM berkas ini.
     *
     * Baris kembar ditolak alih-alih dibiarkan saling menimpa: kalau satu kode outlet muncul
     * dua kali dengan isi berbeda, tidak ada jawaban yang benar soal mana yang menang, dan
     * menebak diam-diam akan menyimpan data yang tidak pernah diperiksa siapa pun.
     */
    const kunciDipakai = new Set<string>();

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

            // Satu nomor boleh muncul berkali-kali untuk sasaran berbeda, jadi kuncinya
            // adalah nomor + scope + sasarannya -- bukan nomornya saja.
            const kunci = `wl:${phone}|${scope}|${outlet?.id || ""}|${tap.toLowerCase()}`;

            if (!phone) errors.push({ row: rowNum, message: "Nomor wajib diisi" });
            else if (!["ALL", "OUTLET", "TAP"].includes(scope)) errors.push({ row: rowNum, message: "Scope tidak valid" });
            else if (scope === "OUTLET" && !outlet) errors.push({ row: rowNum, message: "Outlet tidak ditemukan" });
            else if (scope === "TAP" && !tapTersedia.has(tap.toLowerCase())) errors.push({ row: rowNum, message: "TAP tidak ditemukan pada data outlet" });
            else if (kunciDipakai.has(kunci)) errors.push({ row: rowNum, message: "Nomor dengan scope dan sasaran yang sama muncul lebih dari sekali dalam berkas ini" });
            else {
                kunciDipakai.add(kunci);
                validRows.push({ ...row, phoneE164: phone, scope, outletId: outlet?.id || null, tap: scope === "TAP" ? tap : null });
            }
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

        if (type === "outlet_detail") {
            const outletCode = String(row.outletCode || row.kodeOutlet || "").trim();
            const outlet = outletByCode.get(outletCode);

            if (!outletCode) {
                errors.push({ row: rowNum, message: "Kode Outlet wajib diisi" });
            } else if (!outlet) {
                errors.push({ row: rowNum, message: "Outlet tidak ditemukan" });
            } else {
                // Hanya kolom yang benar-benar ada di berkas yang diambil. Kolom lain
                // dibiarkan apa adanya di database, sehingga satu berkas boleh memuat
                // sebagian grup saja -- misal hanya Recharge Digipos.
                const terisi: Record<string, Record<string, unknown>> = {};
                let jumlahKolom = 0;

                for (const group of MITRA_DETAIL_FIELD_GROUPS) {
                    for (const field of group.fields) {
                        if (!(field.key in row)) continue;
                        const nilai = row[field.key];
                        if (nilai === "" || nilai === null || nilai === undefined) continue;

                        terisi[group.storageKey] = terisi[group.storageKey] || {};
                        terisi[group.storageKey][field.key] = nilai;
                        jumlahKolom += 1;
                    }
                }

                if (jumlahKolom === 0) {
                    errors.push({ row: rowNum, message: "Tidak ada kolom parameter yang terisi" });
                } else {
                    validRows.push({ outletId: outlet.id, outletCode, nilai: terisi });
                }
            }
        }

        if (type === "outlet") {
            const outletCode = teksKolom(row.outletCode || row.kodeOutlet);
            const existing = outletByCode.get(outletCode) || null;

            const name = teksKolom(row.name || row.nama);
            const phoneMentah = teksKolom(row.ownerPhone || row.nomorHp);
            const phone = phoneMentah ? normalizePhoneE164(phoneMentah) : "";
            const kabupaten = teksKolom(row.kabupaten);
            const kunci = `outlet:${outletCode}`;

            if (!/^\d{10}$/.test(outletCode)) {
                errors.push({ row: rowNum, message: "Kode Outlet wajib diisi 10 digit angka" });
            } else if (kunciDipakai.has(kunci)) {
                errors.push({ row: rowNum, message: `Kode Outlet ${outletCode} muncul lebih dari sekali dalam berkas ini` });
            } else if (phoneMentah && !phone) {
                errors.push({ row: rowNum, message: "Nomor HP tidak dikenali formatnya" });
            } else if (!existing && (!name || !phone || !kabupaten)) {
                // Kolom wajib hanya berlaku untuk outlet BARU. Pada outlet yang sudah ada,
                // kolom yang dikosongkan berarti "jangan diubah", bukan "hapus isinya" --
                // sehingga berkas berisi satu kolom saja sudah cukup untuk memperbaikinya.
                errors.push({ row: rowNum, message: "Outlet baru wajib mengisi Nama Outlet, Nomor HP, dan Kabupaten" });
            } else {
                kunciDipakai.add(kunci);
                validRows.push({
                    _aksi: existing ? "UPDATE" : "TAMBAH",
                    _existingId: existing?.id || null,
                    outletCode,
                    name,
                    ownerPhone: phone,
                    rsNumber: teksKolom(row.rsNumber),
                    ownerName: teksKolom(row.ownerName),
                    tap: teksKolom(row.tap),
                    salesforce: teksKolom(row.salesforce),
                    kabupaten,
                    kecamatan: teksKolom(row.kecamatan),
                    latitude: angkaKolom(row.latitude),
                    longitude: angkaKolom(row.longitude),
                    category: teksKolom(row.category),
                    pjpDay: teksKolom(row.pjpDay),
                    pjpType: teksKolom(row.pjpType),
                    branding: teksKolom(row.branding),
                });
            }
        }
    });

    return {
        errors,
        validRows,
        preview: validRows.slice(0, 20),
        // Dihitung untuk tipe yang benar-benar bisa membedakannya. Import lain memakai
        // upsert di sisi database, sehingga jumlah pastinya baru diketahui setelah commit.
        ringkasan: type === "outlet"
            ? {
                tambah: validRows.filter((row) => row._aksi !== "UPDATE").length,
                perbarui: validRows.filter((row) => row._aksi === "UPDATE").length,
            }
            : null,
    };
}

/**
 * Nomor yang sudah terdaftar untuk sasaran yang sama DIPERBARUI, bukan ditambah sebagai
 * baris kedua. Sebelumnya mengunggah ulang berkas yang sama menggandakan seluruh isinya,
 * dan nomor yang sudah dinonaktifkan tidak pernah hidup lagi lewat import.
 */
async function commitWhitelistRows(executor: ImportExecutor, batchId: string, rows: Record<string, unknown>[], userId: string | null) {
    if (rows.length === 0) return;

    const kunci = (phone: string, scope: string, outletId: string | null, tap: string | null) =>
        `${phone}|${scope}|${outletId || ""}|${(tap || "").toLowerCase()}`;

    // Dibaca sekali lalu dicocokkan di memori: satu query per baris akan berarti ribuan
    // perjalanan ke database untuk berkas import yang besar.
    const terdaftar = await executor.select().from(mitraWhitelistNumbers);
    const peta = new Map(terdaftar.map((baris) => [
        kunci(baris.phoneE164, baris.scope, baris.outletId, baris.tap),
        baris,
    ]));

    const tambah: (typeof mitraWhitelistNumbers.$inferInsert)[] = [];

    for (const row of rows) {
        const phone = String(row.phoneE164);
        const scope = row.scope as "ALL" | "OUTLET" | "TAP";
        const outletId = row.outletId ? String(row.outletId) : null;
        const tap = row.tap ? String(row.tap) : null;
        const lama = peta.get(kunci(phone, scope, outletId, tap));

        const isi = {
            name: row.name ? String(row.name) : null,
            keterangan: row.keterangan ? String(row.keterangan) : null,
            expiresAt: row.expiresAt ? new Date(String(row.expiresAt)) : null,
            isActive: true,
        };

        if (lama) {
            // sourceBatchId sengaja TIDAK diubah. Rollback batch menonaktifkan baris milik
            // batch itu; kalau baris lama diklaim batch baru, rollback akan mematikan nomor
            // yang sudah ada jauh sebelum import ini dijalankan.
            await executor.update(mitraWhitelistNumbers).set(isi).where(eq(mitraWhitelistNumbers.id, lama.id));
        } else {
            tambah.push({
                id: uuid(),
                phoneE164: phone,
                scope,
                outletId,
                tap,
                createdBy: userId,
                sourceBatchId: batchId,
                createdAt: new Date(),
                ...isi,
            });
        }
    }

    if (tambah.length) await executor.insert(mitraWhitelistNumbers).values(tambah);
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

/**
 * Nilai baru DIGABUNG dengan yang sudah tersimpan, bukan menimpa seluruh grup. Berkas yang
 * hanya memuat sebagian kolom -- misal cuma angka bulan berjalan -- karena itu tidak
 * menghapus angka bulan sebelumnya yang tidak ikut dikirim.
 */
async function commitOutletDetailRows(executor: ImportExecutor, rows: Record<string, unknown>[]) {
    for (const row of rows) {
        const outletId = String(row.outletId);
        const nilai = (row.nilai || {}) as Record<string, Record<string, unknown>>;

        const [existing] = await executor
            .select()
            .from(mitraOutletDetails)
            .where(eq(mitraOutletDetails.outletId, outletId))
            .limit(1);

        const gabung = (storageKey: "sellthruDigiposJson" | "sellthruNotaJson" | "rechargeDigiposJson", index: number) => {
            const lama = (existing?.[storageKey] || {}) as Record<string, number>;
            const baru = nilai[storageKey];
            if (!baru) return lama;

            return sanitizeDetailGroup(
                { ...lama, ...baru },
                MITRA_DETAIL_FIELD_GROUPS[index].fields.map((field) => field.key)
            );
        };

        const values = {
            outletId,
            sellthruDigiposJson: gabung("sellthruDigiposJson", 0),
            sellthruNotaJson: gabung("sellthruNotaJson", 1),
            rechargeDigiposJson: gabung("rechargeDigiposJson", 2),
        };

        if (existing) {
            await executor.update(mitraOutletDetails).set(values).where(eq(mitraOutletDetails.outletId, outletId));
        } else {
            await executor.insert(mitraOutletDetails).values(values);
        }
    }
}

/**
 * Baris dengan kode outlet yang sudah ada MEMPERBARUI outlet itu; sisanya ditambahkan.
 *
 * Pada pembaruan, hanya kolom yang benar-benar terisi di berkas yang ditulis. Sel kosong
 * berarti "biarkan", bukan "kosongkan" -- berkas yang hanya membawa kolom branding karena
 * itu tidak menghapus alamat dan koordinat outletnya.
 */
async function commitOutletRows(executor: ImportExecutor, rows: Record<string, unknown>[]) {
    if (rows.length === 0) return;

    // Nama salesforce di file hanya teks, jadi diterjemahkan lebih dulu menjadi id master
    // (dibuatkan bila belum ada) supaya satu nama tidak tersimpan berulang di tiap outlet.
    const salesforceIds = await resolveSalesforceIds(rows.map((row) => row.salesforce).filter(Boolean));
    const idSalesforce = (nilai: unknown) =>
        salesforceIds.get(normalizeSalesforceName(nilai).toLowerCase()) || null;

    const baru = rows.filter((row) => row._aksi !== "UPDATE");
    const perbarui = rows.filter((row) => row._aksi === "UPDATE");

    if (baru.length) {
        await executor.insert(mitraOutlets).values(baru.map((row) => {
            const latitude = row.latitude as number | null;
            const longitude = row.longitude as number | null;
            return {
                id: uuid(),
                outletCode: String(row.outletCode),
                publicToken: uuid().replace(/-/g, "").slice(0, 16),
                name: String(row.name),
                ownerPhone: String(row.ownerPhone),
                rsNumber: String(row.rsNumber || ""),
                ownerName: String(row.ownerName || ""),
                tap: String(row.tap || ""),
                salesforceId: idSalesforce(row.salesforce),
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
        }));
    }

    for (const row of perbarui) {
        const set: Partial<typeof mitraOutlets.$inferInsert> = {};

        const teks = (kolom: keyof typeof mitraOutlets.$inferInsert, nilai: unknown) => {
            const isi = String(nilai || "").trim();
            if (isi) Object.assign(set, { [kolom]: isi });
        };

        teks("name", row.name);
        teks("ownerName", row.ownerName);
        teks("ownerPhone", row.ownerPhone);
        teks("rsNumber", row.rsNumber);
        teks("tap", row.tap);
        teks("kabupaten", row.kabupaten);
        teks("kecamatan", row.kecamatan);

        if (String(row.salesforce || "").trim()) set.salesforceId = idSalesforce(row.salesforce);
        if (String(row.category || "").trim()) set.category = normalizeOutletCategory(row.category);
        if (String(row.pjpDay || "").trim()) set.pjpDay = normalizePjpDay(row.pjpDay);
        if (String(row.pjpType || "").trim()) set.pjpType = normalizePjpType(row.pjpType);
        if (String(row.branding || "").trim()) set.branding = normalizeOutletBranding(row.branding);

        // Koordinat hanya ditulis bila KEDUANYA ada: satu angka saja menghasilkan titik
        // yang tidak berarti apa-apa, dan locationUrl diturunkan dari pasangan itu.
        const latitude = row.latitude as number | null;
        const longitude = row.longitude as number | null;
        if (latitude !== null && longitude !== null) {
            set.latitude = latitude;
            set.longitude = longitude;
            set.locationUrl = buildOutletMapsUrl(latitude, longitude) || null;
        }

        // publicToken, status, dan kolom foto sengaja tidak pernah ikut: token adalah alamat
        // QR yang sudah tercetak dan dibagikan, dan foto hanya boleh berubah lewat kunjungan.
        if (Object.keys(set).length === 0) continue;

        await executor.update(mitraOutlets).set(set).where(eq(mitraOutlets.id, String(row._existingId)));
    }
}
