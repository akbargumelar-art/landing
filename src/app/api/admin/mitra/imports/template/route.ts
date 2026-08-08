import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { requireRole } from "@/lib/admin-auth";
import {
    OUTLET_BRANDINGS,
    OUTLET_CATEGORIES,
    PJP_DAYS,
    PJP_TYPES,
} from "@/lib/mitra-outlet-options";
import { MITRA_DETAIL_FIELD_GROUPS } from "@/lib/mitra-fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TemplateType = "whitelist" | "performance" | "program_score" | "outlet" | "outlet_detail";

// Contoh baris data untuk setiap tipe import. Baris ini menjadi panduan kolom
// yang wajib diisi beserta format nilai yang benar.
const TEMPLATES: Record<TemplateType, Record<string, string | number>[]> = {
    whitelist: [
        {
            phone: "08123456789",
            name: "Budi Santoso",
            keterangan: "Outlet Owner",
            scope: "OUTLET",
            outletCode: "2201055482",
            tap: "",
            expiresAt: "",
        },
        {
            phone: "08129998887",
            name: "Siti Aminah",
            keterangan: "Salesforce",
            scope: "TAP",
            outletCode: "",
            tap: "TAP Cirebon Kota",
            expiresAt: "2026-12-31",
        },
        {
            phone: "08127776665",
            name: "Rudi Hartono",
            keterangan: "Organik Telkomsel",
            scope: "ALL",
            outletCode: "",
            tap: "",
            expiresAt: "",
        },
    ],
    performance: [
        {
            outletCode: "OUT-001",
            metricKey: "sellthru_digipos",
            periodYm: "2026-08",
            value: 1500000,
        },
    ],
    program_score: [
        {
            outletCode: "OUT-001",
            programSlug: "program-agustus-2026",
            paramKey: "recharge",
            periodYm: "2026-08",
            rawValue: 500000,
            points: 50,
        },
    ],
    /**
     * Satu baris per outlet, satu kolom per parameter. Kolomnya dibangun dari
     * MITRA_DETAIL_FIELD_GROUPS supaya template tidak pernah tertinggal ketika daftar
     * parameternya berubah. Nilai contohnya 0 -- yang dicari pengisi adalah nama kolomnya.
     */
    outlet_detail: [
        {
            outletCode: "2201055482",
            ...Object.fromEntries(
                MITRA_DETAIL_FIELD_GROUPS.flatMap((group) => group.fields.map((field) => [field.key, 0]))
            ),
        },
    ],
    outlet: [
        {
            outletCode: "2201055482",
            rsNumber: "62812333783",
            name: "Outlet Maju Jaya",
            ownerName: "Ahmad Fauzi",
            ownerPhone: "08123450000",
            tap: "TAP Cirebon Kota",
            salesforce: "Budi Salesforce",
            kabupaten: "Kota Cirebon",
            kecamatan: "Kesambi",
            latitude: -6.732,
            longitude: 108.552,
            category: "FISIK",
            pjpDay: "Senin",
            pjpType: "F4",
            branding: "Telkomsel",
        },
    ],
};

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const type = String(searchParams.get("type") || "whitelist") as TemplateType;

    const rows = TEMPLATES[type];
    if (!rows) {
        return NextResponse.json({ error: "Tipe template tidak dikenal" }, { status: 400 });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

    if (type === "outlet") {
        // Lembar bantu berisi pilihan yang sah, supaya pengisi file tidak menebak-nebak.
        // Nilai di luar daftar tidak menggagalkan import - ia jatuh ke default.
        const maxRows = Math.max(OUTLET_CATEGORIES.length, PJP_DAYS.length, PJP_TYPES.length, OUTLET_BRANDINGS.length);
        const optionRows = Array.from({ length: maxRows }, (_, index) => ({
            "Kategori Outlet": OUTLET_CATEGORIES[index] ?? "",
            "Hari PJP": PJP_DAYS[index] ?? "",
            "Tipe PJP": PJP_TYPES[index] ?? "",
            "Branding Outlet": OUTLET_BRANDINGS[index] ?? "",
        }));
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(optionRows), "Pilihan");
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="template-import-${type}.xlsx"`,
        },
    });
}