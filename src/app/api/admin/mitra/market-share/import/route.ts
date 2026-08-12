import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraMarketShares } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/mitra-utils";
import { MITRA_MARKET_SHARE_FIELDS, normalizeSharePercent } from "@/lib/mitra-market-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kolom wajib beserta beberapa penulisan lain yang lazim dipakai orang. */
const ALIAS_KABUPATEN = ["kabupaten", "kabupaten/kota", "kab", "kota"];
const ALIAS_KECAMATAN = ["kecamatan", "kec"];

function bacaKolom(row: Record<string, unknown>, alias: string[]): string {
    for (const [kunci, nilai] of Object.entries(row)) {
        if (alias.includes(kunci.trim().toLowerCase())) return String(nilai ?? "").trim();
    }
    return "";
}

function bacaOperator(row: Record<string, unknown>, field: (typeof MITRA_MARKET_SHARE_FIELDS)[number]): unknown {
    const alias = [field.key, field.label, field.uploadKey, ...field.uploadAliases]
        .map((item) => item.trim().toLowerCase());
    for (const [kunci, nilai] of Object.entries(row)) {
        const bersih = kunci.trim().toLowerCase();
        if (alias.includes(bersih)) return nilai;
    }
    return 0;
}

/** Template kolom, supaya pengisi berkas tidak perlu menebak namanya. */
export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const contohNilai: Record<string, number> = {
        telkomsel: 45.5,
        xl: 18,
        smartfren: 9.25,
        indosat: 12.75,
        tri: 7.5,
        telkomselAfter: 46,
        xlsmart: 28,
        ioh: 20,
    };
    const contoh = {
        kabupaten: "Kota Cirebon",
        kecamatan: "Kesambi",
        ...Object.fromEntries(MITRA_MARKET_SHARE_FIELDS.map((field) => [field.uploadKey, contohNilai[field.key] ?? 0])),
    };

    const worksheet = XLSX.utils.json_to_sheet([contoh]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Market Share");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="template-market-share.xlsx"',
        },
    });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file") as File | null;

    if (!file) {
        return NextResponse.json({ error: "Berkas belum dipilih" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Ukuran berkas melebihi 5 MB" }, { status: 400 });
    }

    let rows: Record<string, unknown>[];
    try {
        const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    } catch {
        return NextResponse.json({ error: "Berkas tidak terbaca. Pastikan formatnya XLSX atau CSV." }, { status: 400 });
    }

    const errors: { row: number; message: string }[] = [];
    const valid: { kabupaten: string; kecamatan: string; shares: Record<string, string> }[] = [];
    const terlihat = new Set<string>();

    rows.forEach((row, index) => {
        // +2: baris pertama berkas adalah judul kolom, dan penomoran spreadsheet mulai dari 1.
        const nomorBaris = index + 2;
        const kabupaten = bacaKolom(row, ALIAS_KABUPATEN);
        const kecamatan = bacaKolom(row, ALIAS_KECAMATAN);

        if (!kabupaten || !kecamatan) {
            errors.push({ row: nomorBaris, message: "Kabupaten dan kecamatan wajib diisi" });
            return;
        }

        // Baris ganda dalam satu berkas ditolak, bukan diam-diam saling menimpa: kalau
        // dibiarkan, hasil akhirnya bergantung urutan baris dan sulit ditelusuri.
        const kunci = `${kabupaten.toLowerCase()}|${kecamatan.toLowerCase()}`;
        if (terlihat.has(kunci)) {
            errors.push({ row: nomorBaris, message: `${kecamatan}, ${kabupaten} muncul lebih dari sekali` });
            return;
        }
        terlihat.add(kunci);

        valid.push({
            kabupaten,
            kecamatan,
            shares: Object.fromEntries(MITRA_MARKET_SHARE_FIELDS.map((field) => [
                field.key,
                normalizeSharePercent(bacaOperator(row, field)),
            ])),
        });
    });

    if (valid.length === 0) {
        return NextResponse.json(
            { error: "Tidak ada baris yang bisa diproses", errors },
            { status: 400 }
        );
    }

    const now = new Date();
    for (const baris of valid) {
        await db
            .insert(mitraMarketShares)
            .values({ id: uuid(), kabupaten: baris.kabupaten, kecamatan: baris.kecamatan, ...baris.shares, createdAt: now })
            .onDuplicateKeyUpdate({ set: baris.shares });
    }

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "IMPORT",
        entity: "mitra_market_share",
        diff: { fileName: file.name, tersimpan: valid.length, ditolak: errors.length },
        ip: getClientIp(request),
    });

    return NextResponse.json({ saved: valid.length, errors });
}
