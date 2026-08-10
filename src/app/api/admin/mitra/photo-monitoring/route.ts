import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import * as XLSX from "xlsx";

import { db } from "@/db";
import { mitraOutlets, mitraSalesforces } from "@/db/schema";
import { getUserTerritoryIds, isTerritoryScopedRole, requireRole } from "@/lib/admin-auth";
import { BATAS_SEGAR_HARI, MITRA_PHOTO_SLOTS, statusFoto } from "@/lib/mitra-outlet-photos";
import { OUTLET_CATEGORIES } from "@/lib/mitra-outlet-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAKS_BARIS_UNDUH = 20_000;
const KONDISI = ["ALL", "MISSING", "STALE", "FRESH", "NEEDS_UPDATE"] as const;
type Kondisi = (typeof KONDISI)[number];

type OutletRow = Awaited<ReturnType<typeof ambilOutletDalamScope>>[number];

async function ambilOutletDalamScope(territoryIds: string[] | null) {
    if (territoryIds?.length === 0) return [];

    return db
        .select({
            id: mitraOutlets.id,
            outletCode: mitraOutlets.outletCode,
            name: mitraOutlets.name,
            category: mitraOutlets.category,
            tap: mitraOutlets.tap,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
            territoryId: mitraOutlets.territoryId,
            salesforceId: mitraOutlets.salesforceId,
            salesforce: mitraSalesforces.name,
            photoUrl: mitraOutlets.photoUrl,
            photoUpdatedAt: mitraOutlets.photoUpdatedAt,
            photoEtalaseUrl: mitraOutlets.photoEtalaseUrl,
            photoEtalaseUpdatedAt: mitraOutlets.photoEtalaseUpdatedAt,
            photoPopTelkomselUrl: mitraOutlets.photoPopTelkomselUrl,
            photoPopTelkomselUpdatedAt: mitraOutlets.photoPopTelkomselUpdatedAt,
            photoPopKompetitorUrl: mitraOutlets.photoPopKompetitorUrl,
            photoPopKompetitorUpdatedAt: mitraOutlets.photoPopKompetitorUpdatedAt,
        })
        .from(mitraOutlets)
        .leftJoin(mitraSalesforces, eq(mitraOutlets.salesforceId, mitraSalesforces.id))
        .where(territoryIds ? inArray(mitraOutlets.territoryId, territoryIds) : undefined)
        .orderBy(mitraOutlets.name);
}

function teks(nilai: unknown): string {
    return String(nilai ?? "").trim();
}

function buatBarisFoto(outlet: OutletRow) {
    return MITRA_PHOTO_SLOTS.map((slot) => {
        const url = teks(outlet[slot.urlColumn]);
        const updatedAt = outlet[slot.atColumn];
        const status = statusFoto(updatedAt);
        const statusKey = !url ? "MISSING" : status.perluDiperbarui ? "STALE" : "FRESH";

        return {
            id: `${outlet.id}:${slot.key}`,
            outletId: outlet.id,
            outletCode: outlet.outletCode,
            outletName: outlet.name,
            outletCategory: outlet.category,
            tap: outlet.tap || "",
            kabupaten: outlet.kabupaten || "",
            kecamatan: outlet.kecamatan || "",
            salesforceId: outlet.salesforceId || "",
            salesforce: outlet.salesforce || "",
            photoSlot: slot.key,
            photoLabel: slot.label,
            photoUrl: url,
            updatedAt,
            statusKey,
            statusLabel: !url ? "Belum ada foto" : status.label,
            ageDays: status.umurHari,
        };
    });
}

function cocokKondisi(statusKey: string, kondisi: Kondisi): boolean {
    if (kondisi === "ALL") return true;
    if (kondisi === "NEEDS_UPDATE") return statusKey === "MISSING" || statusKey === "STALE";
    return statusKey === kondisi;
}

function formatTanggal(value: Date | null): string {
    if (!value) return "-";
    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
    }).format(value);
}

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const params = new URL(request.url).searchParams;
    const format = params.get("format") || "json";
    const q = teks(params.get("q")).toLowerCase();
    const photoSlot = teks(params.get("photoSlot"));
    const kondisiInput = teks(params.get("condition")).toUpperCase();
    const condition = (KONDISI.includes(kondisiInput as Kondisi) ? kondisiInput : "MISSING") as Kondisi;
    const outletCategory = teks(params.get("outletCategory"));
    const tap = teks(params.get("tap"));
    const salesforceId = teks(params.get("salesforceId"));
    const page = Math.max(Number(params.get("page") || "1"), 1);
    const pageSize = Math.min(Math.max(Number(params.get("pageSize") || "50"), 1), 100);

    let territoryIds: string[] | null = null;
    if (auth.session && isTerritoryScopedRole(auth.session.role)) {
        territoryIds = await getUserTerritoryIds(auth.session.userId);
    }

    const scopedOutlets = await ambilOutletDalamScope(territoryIds);
    const taps = [...new Set(scopedOutlets.map((row) => row.tap).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
    const salesforces = [...new Map(scopedOutlets
        .filter((row) => row.salesforceId && row.salesforce)
        .map((row) => [row.salesforceId as string, { id: row.salesforceId as string, name: row.salesforce as string }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, "id"));

    const outletTersaring = scopedOutlets.filter((outlet) => {
        if (outletCategory && outlet.category !== outletCategory) return false;
        if (tap && outlet.tap !== tap) return false;
        if (salesforceId && outlet.salesforceId !== salesforceId) return false;
        if (!q) return true;

        return [outlet.outletCode, outlet.name, outlet.tap, outlet.kabupaten, outlet.kecamatan, outlet.salesforce]
            .some((value) => teks(value).toLowerCase().includes(q));
    });

    const semuaBaris = outletTersaring.flatMap(buatBarisFoto);
    const summary = Object.fromEntries(MITRA_PHOTO_SLOTS.map((slot) => {
        const rows = semuaBaris.filter((row) => row.photoSlot === slot.key);
        return [slot.key, {
            label: slot.label,
            total: rows.length,
            missing: rows.filter((row) => row.statusKey === "MISSING").length,
            stale: rows.filter((row) => row.statusKey === "STALE").length,
            fresh: rows.filter((row) => row.statusKey === "FRESH").length,
        }];
    }));

    const barisTersaring = semuaBaris.filter((row) => {
        if (photoSlot && photoSlot !== "ALL" && row.photoSlot !== photoSlot) return false;
        return cocokKondisi(row.statusKey, condition);
    });

    if (format === "xlsx") {
        const exportRows = barisTersaring.slice(0, MAKS_BARIS_UNDUH).map((row) => ({
            "ID Digipos": row.outletCode,
            "Nama Outlet": row.outletName,
            "Kategori Outlet": row.outletCategory,
            "TAP": row.tap,
            "Salesforce": row.salesforce,
            "Kabupaten": row.kabupaten,
            "Kecamatan": row.kecamatan,
            "Kategori Foto": row.photoLabel,
            "Status Foto": row.statusLabel,
            "Terakhir Diperbarui": formatTanggal(row.updatedAt),
            "Umur Foto (Hari)": row.ageDays ?? "Belum pernah",
            "URL Foto": row.photoUrl,
        }));

        const worksheet = exportRows.length
            ? XLSX.utils.json_to_sheet(exportRows)
            : XLSX.utils.aoa_to_sheet([["ID Digipos", "Nama Outlet", "Kategori Outlet", "TAP", "Salesforce", "Kabupaten", "Kecamatan", "Kategori Foto", "Status Foto", "Terakhir Diperbarui", "Umur Foto (Hari)", "URL Foto"]]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Monitoring Foto");
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="monitoring-foto-outlet-${new Date().toISOString().slice(0, 10)}.xlsx"`,
            },
        });
    }

    const pageCount = Math.max(Math.ceil(barisTersaring.length / pageSize), 1);
    const halaman = Math.min(page, pageCount);
    const rows = barisTersaring.slice((halaman - 1) * pageSize, halaman * pageSize);

    return NextResponse.json({
        rows,
        total: barisTersaring.length,
        page: halaman,
        pageSize,
        pageCount,
        summary,
        filters: { categories: OUTLET_CATEGORIES, taps, salesforces },
        staleAfterDays: BATAS_SEGAR_HARI,
        exportTruncated: barisTersaring.length > MAKS_BARIS_UNDUH,
    });
}
