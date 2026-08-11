import { and, asc, count, desc, eq, gt, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { resolveOutletMapsUrl } from "@/lib/mitra-outlet-options";

import { db } from "@/db";
import {
    mitraDetailSessions,
    mitraImportBatches,
    mitraMarketShares,
    mitraMetricDefs,
    mitraOutletDetails,
    mitraOutletMetrics,
    mitraOutlets,
    mitraPrograms,
    mitraSalesforces,
    mitraWhitelistNumbers,
    mitraWhitelistUsageLogs,
} from "@/db/schema";
import { getOutletEditLogs } from "@/lib/mitra-outlet-edit";
import {
    hashSessionToken,
    isFuture,
    maskPhone,
    normalizePhoneE164,
} from "@/lib/mitra-utils";

/**
 * Tautan wa.me beserta pesan pembuka yang sudah menyebut nama outlet, supaya salesforce
 * langsung tahu konteksnya tanpa mitra perlu mengetik ulang.
 */
function buildWhatsAppUrl(phone: string | null, outletName: string): string | null {
    if (!phone) return null;
    const angka = phone.replace(/\D/g, "");
    if (!angka) return null;

    const pesan = encodeURIComponent(`Halo, saya dari outlet ${outletName}. Mohon bantuannya.`);
    return `https://wa.me/${angka}?text=${pesan}`;
}

export type PublicMitraOutlet = NonNullable<Awaited<ReturnType<typeof getPublicOutletByToken>>>;

export async function getMitraOutletRecordByToken(publicToken: string) {
    const [row] = await db
        .select({
            id: mitraOutlets.id,
            outletCode: mitraOutlets.outletCode,
            publicToken: mitraOutlets.publicToken,
            rsNumber: mitraOutlets.rsNumber,
            name: mitraOutlets.name,
            ownerName: mitraOutlets.ownerName,
            ownerPhone: mitraOutlets.ownerPhone,
            tap: mitraOutlets.tap,
            // Nama dan foto salesforce datang dari master lewat join, tetapi tetap
            // dikembalikan dengan nama field yang sama seperti sebelumnya supaya
            // halaman publik tidak perlu tahu asalnya berubah.
            salesforce: mitraSalesforces.name,
            salesforcePhotoUrl: mitraSalesforces.photoUrl,
            salesforcePhone: mitraSalesforces.phone,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
            longitude: mitraOutlets.longitude,
            latitude: mitraOutlets.latitude,
            locationUrl: mitraOutlets.locationUrl,
            category: mitraOutlets.category,
            pjpDay: mitraOutlets.pjpDay,
            pjpType: mitraOutlets.pjpType,
            branding: mitraOutlets.branding,
            status: mitraOutlets.status,
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
        .where(eq(mitraOutlets.publicToken, publicToken))
        .limit(1);

    if (!row) return null;

    return row;
}

export async function getPublicOutletByToken(publicToken: string) {
    const row = await getMitraOutletRecordByToken(publicToken);
    if (!row) return null;

    return {
        publicToken: row.publicToken,
        outletCode: row.outletCode,
        name: row.name,
        kabupaten: row.kabupaten,
        kecamatan: row.kecamatan,
        category: row.category,
        pjpDay: row.pjpDay,
        pjpType: row.pjpType,
        branding: row.branding,
        status: row.status,
        // Keempat slot foto ikut dibuka di profil publik: foto outlet bukan data
        // sensitif, dan kebaruannya justru bukti kunjungan yang ingin dilihat.
        photoUrl: row.photoUrl,
        // Koordinat outlet memang sudah publik lewat peta sebaran di /mitra. Rincian ODP
        // sekitar tidak memakai respons ini dan tetap dilindungi sesi OTP.
        latitude: row.latitude,
        longitude: row.longitude,
        photoUpdatedAt: row.photoUpdatedAt,
        photoEtalaseUrl: row.photoEtalaseUrl,
        photoEtalaseUpdatedAt: row.photoEtalaseUpdatedAt,
        photoPopTelkomselUrl: row.photoPopTelkomselUrl,
        photoPopTelkomselUpdatedAt: row.photoPopTelkomselUpdatedAt,
        photoPopKompetitorUrl: row.photoPopKompetitorUrl,
        photoPopKompetitorUpdatedAt: row.photoPopKompetitorUpdatedAt,
        // Territory diganti TAP + salesforce di profil publik: nama cabang dan petugas
        // yang mengunjungi outlet jauh lebih berarti bagi mitra daripada kode wilayah internal.
        tap: row.tap,
        salesforce: row.salesforce,
        salesforcePhotoUrl: row.salesforcePhotoUrl,
        // Nomor ditampilkan tersamar, tetapi tautan wa.me memang membawa nomor utuhnya --
        // itu justru tujuan tombolnya. Penyamaran di sini soal kerapian tampilan, bukan
        // kerahasiaan: siapa pun bisa membaca nomor itu dari tautannya.
        salesforcePhoneMasked: row.salesforcePhone ? maskPhone(row.salesforcePhone) : null,
        salesforceWaUrl: buildWhatsAppUrl(row.salesforcePhone, row.name),
        ownerPhoneMasked: maskPhone(row.ownerPhone),
    };
}

/**
 * Memastikan sesi detail berasal dari OTP yang sah untuk outlet yang sama. Helper ini
 * dipakai semua data tambahan yang hanya boleh terbuka setelah OTP, termasuk rincian ODP.
 */
export async function getOutletWithValidDetailSession(publicToken: string, sessionToken: string | undefined) {
    if (!sessionToken) return null;

    const outletRecord = await getMitraOutletRecordByToken(publicToken);
    if (!outletRecord) return null;

    const [detailSession] = await db
        .select()
        .from(mitraDetailSessions)
        .where(
            and(
                eq(mitraDetailSessions.tokenHash, hashSessionToken(sessionToken)),
                eq(mitraDetailSessions.outletId, outletRecord.id),
                gt(mitraDetailSessions.expiresAt, new Date())
            )
        )
        .limit(1);

    return detailSession ? { outletRecord, detailSession } : null;
}

export async function getOutletDetailWithSession(publicToken: string, sessionToken: string | undefined) {
    const access = await getOutletWithValidDetailSession(publicToken, sessionToken);
    if (!access) return null;

    const { outletRecord, detailSession } = access;
    const outlet = await getPublicOutletByToken(publicToken);
    if (!outlet) return null;

    const [detailRow] = await db
        .select({
            ownerPhone: mitraOutlets.ownerPhone,
            sellthruDigiposJson: mitraOutletDetails.sellthruDigiposJson,
            sellthruNotaJson: mitraOutletDetails.sellthruNotaJson,
            rechargeDigiposJson: mitraOutletDetails.rechargeDigiposJson,
            // Diisi otomatis oleh onUpdateNow, jadi mencerminkan perubahan terakhir dari
            // jalur mana pun -- unggahan berkas maupun suntingan manual admin.
            updatedAt: mitraOutletDetails.updatedAt,
        })
        .from(mitraOutlets)
        .leftJoin(mitraOutletDetails, eq(mitraOutlets.id, mitraOutletDetails.outletId))
        .where(eq(mitraOutlets.id, outletRecord.id))
        .limit(1);
    const performance = await db
        .select({
            metricKey: mitraMetricDefs.key,
            metricLabel: mitraMetricDefs.label,
            unit: mitraMetricDefs.unit,
            periodYm: mitraOutletMetrics.periodYm,
            value: mitraOutletMetrics.value,
        })
        .from(mitraOutletMetrics)
        .innerJoin(mitraMetricDefs, eq(mitraOutletMetrics.metricDefId, mitraMetricDefs.id))
        .where(eq(mitraOutletMetrics.outletId, outletRecord.id))
        .orderBy(desc(mitraOutletMetrics.periodYm), asc(mitraMetricDefs.label))
        .limit(120);

    // Dicocokkan pada pasangan kabupaten + kecamatan persis seperti yang tersimpan di
    // outlet. Selisih ejaan sekecil apa pun membuat baris tidak ketemu, dan itu memang
    // disengaja: lebih baik tidak menampilkan angka daripada menampilkan angka wilayah lain.
    const whitelistPengakses = await findMatchingWhitelist(detailSession.phoneE164, {
        id: outletRecord.id,
        tap: outletRecord.tap,
    });

    const [marketShare] = outletRecord.kabupaten && outletRecord.kecamatan
        ? await db
            .select()
            .from(mitraMarketShares)
            .where(and(
                eq(mitraMarketShares.kabupaten, outletRecord.kabupaten),
                eq(mitraMarketShares.kecamatan, outletRecord.kecamatan)
            ))
            .limit(1)
        : [];

    return {
        outlet: {
            ...outlet,
            ownerName: outletRecord.ownerName,
            rsNumber: outletRecord.rsNumber,
            longitude: outletRecord.longitude,
            latitude: outletRecord.latitude,
            // Diturunkan dari koordinat supaya tautan selalu cocok dengan lat/long tersimpan.
            locationUrl: resolveOutletMapsUrl(outletRecord.latitude, outletRecord.longitude, outletRecord.locationUrl),
        },
        detailSession,
        details: {
            ownerPhone: detailRow?.ownerPhone || "",
            sellthruDigipos: detailRow?.sellthruDigiposJson || {},
            sellthruNota: detailRow?.sellthruNotaJson || {},
            rechargeDigipos: detailRow?.rechargeDigiposJson || {},
            updatedAt: detailRow?.updatedAt || null,
        },
        performance,
        marketShare: marketShare || null,
        editLogs: await getOutletEditLogs(outletRecord.id),
        /**
         * Sesi OTP kini murni baca. Field dipertahankan dan dipaku `false` selama masa
         * kompatibilitas supaya build lama yang masih membacanya menyembunyikan kontrol edit
         * alih-alih menampilkan tombol yang pasti ditolak server.
         */
        bolehEdit: false as const,
        peranPengakses: whitelistPengakses?.keterangan || null,
    };
}

export async function findMatchingWhitelist(phone: string, outlet: { id: string; tap: string | null }) {
    const phoneE164 = normalizePhoneE164(phone);
    if (!phoneE164) return null;

    const candidates = await db
        .select()
        .from(mitraWhitelistNumbers)
        .where(
            and(
                eq(mitraWhitelistNumbers.phoneE164, phoneE164),
                eq(mitraWhitelistNumbers.isActive, true)
            )
        );

    return candidates.find((candidate) => {
        if (candidate.expiresAt && !isFuture(candidate.expiresAt)) return false;
        if (candidate.scope === "ALL") return true;
        if (candidate.scope === "OUTLET") return candidate.outletId === outlet.id;
        // Dicocokkan tanpa membedakan huruf besar/kecil dan spasi tepi: nama TAP diketik
        // manusia di dua tempat berbeda (data outlet dan form whitelist).
        if (candidate.scope === "TAP") {
            const tapOutlet = (outlet.tap || "").trim().toLowerCase();
            const tapKandidat = (candidate.tap || "").trim().toLowerCase();
            return Boolean(tapOutlet && tapKandidat && tapOutlet === tapKandidat);
        }
        return false;
    }) || null;
}

export async function writeWhitelistUsage(input: {
    whitelistId?: string | null;
    phoneE164: string;
    outletId?: string | null;
    programId?: string | null;
    action: "OTP_REQUESTED" | "OTP_VERIFIED" | "OTP_REJECTED";
    ip?: string | null;
}) {
    await db.insert(mitraWhitelistUsageLogs).values({
        id: uuid(),
        whitelistId: input.whitelistId || null,
        phoneE164: input.phoneE164,
        outletId: input.outletId || null,
        programId: input.programId || null,
        action: input.action,
        ip: input.ip || null,
        createdAt: new Date(),
    });
}

/**
 * Nomor yang berhak membuka halaman yang tidak terikat outlet tertentu -- misalnya
 * program salesforce. Cakupan whitelist (ALL/OUTLET/TAP) tidak diperiksa di sini karena
 * tidak ada outlet pembanding: yang dituntut hanya nomor itu benar terdaftar dan masih
 * berlaku.
 */
export async function findActiveWhitelistNumber(phone: string) {
    const phoneE164 = normalizePhoneE164(phone);
    if (!phoneE164) return null;

    const candidates = await db
        .select()
        .from(mitraWhitelistNumbers)
        .where(and(
            eq(mitraWhitelistNumbers.phoneE164, phoneE164),
            eq(mitraWhitelistNumbers.isActive, true)
        ));

    return candidates.find((candidate) => !candidate.expiresAt || isFuture(candidate.expiresAt)) || null;
}

export async function getMitraAdminSummary() {
    const [outletCount] = await db.select({ value: count() }).from(mitraOutlets);
    const [activeProgramCount] = await db
        .select({ value: count() })
        .from(mitraPrograms)
        .where(inArray(mitraPrograms.status, ["ACTIVE", "PUBLISHED"]));
    const [whitelistCount] = await db
        .select({ value: count() })
        .from(mitraWhitelistNumbers)
        .where(eq(mitraWhitelistNumbers.isActive, true));
    const [otpUsageCount] = await db.select({ value: count() }).from(mitraWhitelistUsageLogs);
    const [importCount] = await db.select({ value: count() }).from(mitraImportBatches);
    const [metricCount] = await db.select({ value: count() }).from(mitraOutletMetrics);

    return {
        outlets: outletCount?.value || 0,
        activePrograms: activeProgramCount?.value || 0,
        whitelistNumbers: whitelistCount?.value || 0,
        otpEvents: otpUsageCount?.value || 0,
        imports: importCount?.value || 0,
        metrics: metricCount?.value || 0,
    };
}
