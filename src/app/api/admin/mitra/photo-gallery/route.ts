import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutlets, mitraSalesforces } from "@/db/schema";
import { requireRole } from "@/lib/admin-auth";
import { getAdminActorScope, outletScopeCondition, type AdminActorScope } from "@/lib/admin-scope";
import { MITRA_PHOTO_SLOTS } from "@/lib/mitra-outlet-photos";
import { PJP_DAYS } from "@/lib/mitra-outlet-options";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 60;
const PAGE_SIZE_MAKS = 120;

type OutletRow = Awaited<ReturnType<typeof ambilOutletDalamScope>>[number];

async function ambilOutletDalamScope(scope: AdminActorScope) {

    return db
        .select({
            id: mitraOutlets.id,
            outletCode: mitraOutlets.outletCode,
            name: mitraOutlets.name,
            tap: mitraOutlets.tap,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
            pjpDay: mitraOutlets.pjpDay,
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
        .where(outletScopeCondition(scope) ?? undefined)
        .orderBy(mitraOutlets.name);
}

function teks(nilai: unknown): string {
    return String(nilai ?? "").trim();
}

/** Galeri hanya berisi foto yang benar-benar ada -- tidak ada baris "belum ada foto" di sini. */
function buatFotoOutlet(outlet: OutletRow) {
    return MITRA_PHOTO_SLOTS.map((slot) => {
        const url = teks(outlet[slot.urlColumn]);
        if (!url) return null;

        return {
            id: `${outlet.id}:${slot.key}`,
            outletId: outlet.id,
            outletCode: outlet.outletCode,
            outletName: outlet.name,
            tap: outlet.tap || "",
            kabupaten: outlet.kabupaten || "",
            kecamatan: outlet.kecamatan || "",
            pjpDay: outlet.pjpDay,
            salesforceId: outlet.salesforceId || "",
            salesforce: outlet.salesforce || "",
            photoSlot: slot.key,
            photoLabel: slot.label,
            photoUrl: url,
            updatedAt: outlet[slot.atColumn],
        };
    }).filter((row): row is NonNullable<typeof row> => row !== null);
}

/**
 * Awal hari menurut WIB, sama seperti /api/admin/mitra/outlet-edits: tanggal yang diketik
 * admin dibaca sebagai tanggal Indonesia, bukan tanggal server.
 */
function tengahMalamWib(tanggal: string, geserHari = 0): Date {
    const waktu = new Date(`${tanggal}T00:00:00+07:00`);
    waktu.setUTCDate(waktu.getUTCDate() + geserHari);
    return waktu;
}

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const params = new URL(request.url).searchParams;
    const dari = params.get("dari") || "";
    const sampai = params.get("sampai") || "";
    const tap = teks(params.get("tap"));
    const pjpDay = teks(params.get("pjpDay"));
    const salesforceId = teks(params.get("salesforceId"));
    const kabupaten = teks(params.get("kabupaten"));
    const kecamatan = teks(params.get("kecamatan"));
    const photoSlot = teks(params.get("photoSlot"));
    const page = Math.max(Number(params.get("page") || "1"), 1);
    const pageSize = Math.min(Math.max(Number(params.get("pageSize") || String(PAGE_SIZE_DEFAULT)), 1), PAGE_SIZE_MAKS);

    // Cakupan dibatasi di query, bukan disaring setelah baris terbaca: seluruh opsi filter,
    // cacah, dan ringkasan di bawah diturunkan dari daftar ini, jadi menyaring belakangan akan
    // membocorkan keberadaan outlet di luar wewenang lewat angka-angkanya.
    const scope = await getAdminActorScope();
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const scopedOutlets = await ambilOutletDalamScope(scope);

    /**
     * Opsi filter saling menyesuaikan: daftar pilihan sebuah filter dihitung dari outlet yang
     * sudah lolos filter WILAYAH LAINNYA, bukan dari seluruh cakupan.
     *
     * Tanpa ini setiap dropdown menawarkan seluruh nilai yang ada di cakupan, sehingga
     * kombinasi yang mustahil -- mis. TAP "Kuningan" dengan kecamatan "Plumbon" yang tidak
     * pernah berada di TAP itu -- tetap bisa dipilih dan berakhir nol hasil. Galeri yang
     * mendadak kosong itu terbaca sebagai kerusakan, padahal penyaringnya bekerja benar;
     * yang salah adalah pilihan yang seharusnya tidak pernah ditawarkan.
     */
    const cocokWilayah = (
        outlet: OutletRow,
        kecuali: "tap" | "kabupaten" | "kecamatan" | "salesforce" | null,
    ) => {
        if (kecuali !== "tap" && tap && outlet.tap !== tap) return false;
        if (kecuali !== "kabupaten" && kabupaten && outlet.kabupaten !== kabupaten) return false;
        if (kecuali !== "kecamatan" && kecamatan && outlet.kecamatan !== kecamatan) return false;
        if (kecuali !== "salesforce" && salesforceId && outlet.salesforceId !== salesforceId) return false;
        return true;
    };

    const opsiUnik = (
        kecuali: "tap" | "kabupaten" | "kecamatan",
        ambil: (outlet: OutletRow) => string | null,
    ) => [...new Set(scopedOutlets.filter((row) => cocokWilayah(row, kecuali)).map(ambil).filter(Boolean))]
        .sort((a, b) => (a as string).localeCompare(b as string, "id")) as string[];

    const taps = opsiUnik("tap", (row) => row.tap);
    const kabupatens = opsiUnik("kabupaten", (row) => row.kabupaten);
    const kecamatans = opsiUnik("kecamatan", (row) => row.kecamatan);
    const salesforces = [...new Map(scopedOutlets
        .filter((row) => cocokWilayah(row, "salesforce"))
        .filter((row) => row.salesforceId && row.salesforce)
        .map((row) => [row.salesforceId as string, { id: row.salesforceId as string, name: row.salesforce as string }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, "id"));

    const outletTersaring = scopedOutlets.filter((outlet) => {
        if (tap && outlet.tap !== tap) return false;
        if (pjpDay && outlet.pjpDay !== pjpDay) return false;
        if (salesforceId && outlet.salesforceId !== salesforceId) return false;
        if (kabupaten && outlet.kabupaten !== kabupaten) return false;
        if (kecamatan && outlet.kecamatan !== kecamatan) return false;
        return true;
    });

    let foto = outletTersaring.flatMap(buatFotoOutlet);

    if (photoSlot && photoSlot !== "ALL") {
        foto = foto.filter((row) => row.photoSlot === photoSlot);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dari)) {
        const batasBawah = tengahMalamWib(dari);
        foto = foto.filter((row) => row.updatedAt && row.updatedAt >= batasBawah);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(sampai)) {
        // Batas atas eksklusif ke hari berikutnya, supaya seluruh perubahan pada tanggal
        // "sampai" ikut masuk, bukan terpotong di pukul 00:00.
        const batasAtas = tengahMalamWib(sampai, 1);
        foto = foto.filter((row) => row.updatedAt && row.updatedAt < batasAtas);
    }

    // Unggahan terbaru duluan -- itulah yang paling relevan saat menelusuri galeri.
    foto.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));

    const pageCount = Math.max(Math.ceil(foto.length / pageSize), 1);
    const halaman = Math.min(page, pageCount);
    const rows = foto.slice((halaman - 1) * pageSize, halaman * pageSize);

    return NextResponse.json({
        rows,
        total: foto.length,
        page: halaman,
        pageSize,
        pageCount,
        filters: {
            taps,
            salesforces,
            kabupatens,
            kecamatans,
            pjpDays: PJP_DAYS,
            photoSlots: MITRA_PHOTO_SLOTS.map((slot) => ({ key: slot.key, label: slot.label })),
        },
    });
}
