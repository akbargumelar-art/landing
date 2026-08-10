import { NextResponse } from "next/server";
import { and, desc, eq, gte, like, lt, or, type SQL } from "drizzle-orm";
import * as XLSX from "xlsx";

import { db } from "@/db";
import { mitraOutletEditLogs, mitraOutlets, mitraSalesforces, user } from "@/db/schema";
import { requireRole } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Riwayat perubahan data outlet yang dilakukan dari Portal Mitra (foto, long-lat, branding),
 * untuk ditampilkan di layar sekaligus diunduh sebagai Excel.
 *
 * Terpisah dari resource `audit` di /api/admin/mitra: yang itu membaca admin_audit_logs --
 * jejak aksi ADMIN di panel. Yang di sini membaca mitra_outlet_edit_logs, yaitu perubahan
 * yang dilakukan pemegang OTP di lapangan. Dua tabel berbeda dengan pembaca berbeda pula.
 */

/** Batas baris unduhan. Cukup untuk setahun kunjungan, dan menjaga memori proses tetap wajar. */
const MAKS_BARIS_UNDUH = 20_000;

/** Layar hanya butuh yang terbaru; unduhan yang mengambil rentang penuh. */
const MAKS_BARIS_LAYAR = 300;

const LABEL_AKSI: Record<string, string> = {
    PHOTO: "Foto",
    LOCATION: "Long-Lat",
    BRANDING: "Branding",
};

/**
 * Awal hari menurut WIB, bukan menurut zona waktu server.
 *
 * Tanggal yang diketik admin dibaca sebagai tanggal Indonesia, dan kolom Waktu pada tabel
 * maupun berkas Excel juga ditampilkan dalam WIB. Memakai `new Date("...T00:00:00")` akan
 * memakai zona waktu proses: di server yang berjalan UTC, "sampai 10 Agustus" ikut menarik
 * tujuh jam pertama tanggal 11 -- baris yang di layar jelas-jelas tertulis 11 Agustus.
 *
 * Offset ditulis eksplisit supaya hasilnya sama di server mana pun. Konversi ke waktu
 * penyimpanan diserahkan ke driver MySQL, seperti halnya saat baris itu ditulis.
 */
function tengahMalamWib(tanggal: string, geserHari = 0): Date {
    const waktu = new Date(`${tanggal}T00:00:00+07:00`);
    waktu.setUTCDate(waktu.getUTCDate() + geserHari);
    return waktu;
}

function teks(nilai: unknown): string {
    if (nilai === null || nilai === undefined || nilai === "") return "";
    return String(nilai);
}

/**
 * Menerjemahkan before/after yang bentuknya berbeda per jenis aksi menjadi tiga kolom yang
 * sama untuk semua baris. Tanpa ini, kolom "Diff" berisi JSON mentah -- terbaca oleh yang
 * menulis kodenya, tidak oleh yang membaca laporannya.
 */
function ringkasPerubahan(action: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
    const sebelum = before || {};
    const sesudah = after || {};

    if (action === "PHOTO") {
        return {
            keterangan: `Foto ${teks(sesudah.label) || teks(sesudah.slot)}`.trim(),
            nilaiSebelum: teks(sebelum.url) || "(belum ada foto)",
            nilaiSesudah: teks(sesudah.url),
        };
    }

    if (action === "LOCATION") {
        const titik = (data: Record<string, unknown>) => {
            const lat = teks(data.latitude);
            const lng = teks(data.longitude);
            return lat && lng ? `${lat}, ${lng}` : "(belum ada titik)";
        };
        const akurasi = teks(sesudah.accuracy);

        return {
            keterangan: akurasi ? `Titik long-lat (akurasi ±${Math.round(Number(akurasi))} m)` : "Titik long-lat",
            nilaiSebelum: titik(sebelum),
            nilaiSesudah: titik(sesudah),
        };
    }

    if (action === "BRANDING") {
        return {
            keterangan: "Branding outlet",
            nilaiSebelum: teks(sebelum.branding),
            nilaiSesudah: teks(sesudah.branding),
        };
    }

    return {
        keterangan: action,
        nilaiSebelum: JSON.stringify(sebelum),
        nilaiSesudah: JSON.stringify(sesudah),
    };
}

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR"]);
    if (auth.error) return auth.error;

    const params = new URL(request.url).searchParams;
    const format = params.get("format") || "json";
    const action = (params.get("action") || "").toUpperCase();
    const dari = params.get("dari") || "";
    const sampai = params.get("sampai") || "";
    const q = (params.get("q") || "").trim();

    const filters: SQL[] = [];

    if (action && action in LABEL_AKSI) {
        filters.push(eq(mitraOutletEditLogs.action, action as "PHOTO" | "LOCATION" | "BRANDING"));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dari)) {
        filters.push(gte(mitraOutletEditLogs.createdAt, tengahMalamWib(dari)));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(sampai)) {
        // Batas atas eksklusif ke hari BERIKUTNYA: memakai `<= sampai` akan memotong seluruh
        // perubahan yang terjadi pada tanggal itu setelah pukul 00:00.
        filters.push(lt(mitraOutletEditLogs.createdAt, tengahMalamWib(sampai, 1)));
    }
    if (q) {
        const pola = `%${q}%`;
        filters.push(or(like(mitraOutlets.outletCode, pola), like(mitraOutlets.name, pola), like(mitraOutlets.tap, pola))!);
    }

    const baris = await db
        .select({
            id: mitraOutletEditLogs.id,
            createdAt: mitraOutletEditLogs.createdAt,
            action: mitraOutletEditLogs.action,
            actorType: mitraOutletEditLogs.actorType,
            actorPhone: mitraOutletEditLogs.actorPhone,
            adminName: user.name,
            beforeJson: mitraOutletEditLogs.beforeJson,
            afterJson: mitraOutletEditLogs.afterJson,
            ip: mitraOutletEditLogs.ip,
            outletCode: mitraOutlets.outletCode,
            outletName: mitraOutlets.name,
            tap: mitraOutlets.tap,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
            salesforce: mitraSalesforces.name,
        })
        .from(mitraOutletEditLogs)
        .innerJoin(mitraOutlets, eq(mitraOutletEditLogs.outletId, mitraOutlets.id))
        .leftJoin(mitraSalesforces, eq(mitraOutlets.salesforceId, mitraSalesforces.id))
        .leftJoin(user, eq(mitraOutletEditLogs.actorUserId, user.id))
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(mitraOutletEditLogs.createdAt))
        .limit(format === "xlsx" ? MAKS_BARIS_UNDUH : MAKS_BARIS_LAYAR);

    const hasil = baris.map((row) => {
        const ringkas = ringkasPerubahan(row.action, row.beforeJson, row.afterJson);
        return {
            id: row.id,
            createdAt: row.createdAt,
            action: row.action,
            jenis: LABEL_AKSI[row.action] || row.action,
            outletCode: row.outletCode,
            outletName: row.outletName,
            tap: row.tap || "",
            kabupaten: row.kabupaten || "",
            kecamatan: row.kecamatan || "",
            salesforce: row.salesforce || "",
            // Admin yang mengubah dari panel diidentifikasi namanya; mitra di lapangan
            // dari nomor WhatsApp yang dipakai lolos OTP.
            aktor: row.actorType === "ADMIN" ? (row.adminName || "Admin") : (row.actorPhone || "Mitra"),
            actorType: row.actorType,
            ip: row.ip || "",
            ...ringkas,
        };
    });

    if (format !== "xlsx") {
        return NextResponse.json({ rows: hasil, count: hasil.length, truncated: hasil.length === MAKS_BARIS_LAYAR });
    }

    const lembar = hasil.map((row) => ({
        "Waktu": new Intl.DateTimeFormat("id-ID", {
            dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jakarta",
        }).format(row.createdAt),
        "ID Digipos": row.outletCode,
        "Nama Outlet": row.outletName,
        "TAP": row.tap,
        "Kabupaten": row.kabupaten,
        "Kecamatan": row.kecamatan,
        "Salesforce": row.salesforce,
        "Jenis Perubahan": row.jenis,
        "Keterangan": row.keterangan,
        "Nilai Sebelum": row.nilaiSebelum,
        "Nilai Sesudah": row.nilaiSesudah,
        "Diubah Oleh": row.aktor,
        "Tipe Pengubah": row.actorType,
        "IP": row.ip,
    }));

    // Satu baris header tetap ditulis walau tidak ada data, supaya berkas yang terunduh
    // tetap punya kolom dan tidak terbaca sebagai file rusak.
    const worksheet = lembar.length
        ? XLSX.utils.json_to_sheet(lembar)
        : XLSX.utils.aoa_to_sheet([[
            "Waktu", "ID Digipos", "Nama Outlet", "TAP", "Kabupaten", "Kecamatan", "Salesforce",
            "Jenis Perubahan", "Keterangan", "Nilai Sebelum", "Nilai Sesudah", "Diubah Oleh",
            "Tipe Pengubah", "IP",
        ]]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Perubahan Outlet");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const namaBerkas = `perubahan-outlet-${dari || "awal"}-sd-${sampai || "kini"}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${namaBerkas}"`,
        },
    });
}
