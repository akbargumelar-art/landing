import { and, asc, count, desc, eq, gt, inArray, like, or } from "drizzle-orm";
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
    mitraProgramLeaderboard,
    mitraProgramParams,
    mitraProgramParticipants,
    mitraProgramRewardRules,
    mitraProgramScores,
    mitraPrograms,
    mitraProgramWinners,
    mitraSalesforces,
    mitraWhitelistNumbers,
    mitraWhitelistUsageLogs,
} from "@/db/schema";
import { getOutletEditLogs } from "@/lib/mitra-outlet-edit";
import { bolehEditOutlet } from "@/lib/mitra-whitelist-roles";
import {
    hashSessionToken,
    isFuture,
    maskPhone,
    normalizePhoneE164,
    toDecimalString,
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

    // Dipakai mengisi dropdown kabupaten/kecamatan yang saling terhubung di form edit
    // profil -- daftarnya wilayah yang benar-benar sudah dipakai outlet lain, bukan
    // ketikan bebas, supaya tidak ada wilayah baru yang salah eja masuk ke data.
    const wilayahRows = await db
        .selectDistinct({ kabupaten: mitraOutlets.kabupaten, kecamatan: mitraOutlets.kecamatan })
        .from(mitraOutlets);

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
        wilayah: wilayahRows.filter((row): row is { kabupaten: string; kecamatan: string } => Boolean(row.kabupaten && row.kecamatan)),
        editLogs: await getOutletEditLogs(outletRecord.id),
        // Dipakai halaman untuk menyembunyikan kontrol yang memang akan ditolak server.
        bolehEdit: bolehEditOutlet(whitelistPengakses?.keterangan),
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
    outletId: string;
    action: "OTP_REQUESTED" | "OTP_VERIFIED" | "OTP_REJECTED";
    ip?: string | null;
}) {
    await db.insert(mitraWhitelistUsageLogs).values({
        id: uuid(),
        whitelistId: input.whitelistId || null,
        phoneE164: input.phoneE164,
        outletId: input.outletId,
        action: input.action,
        ip: input.ip || null,
        createdAt: new Date(),
    });
}

export async function getPublicMitraPrograms() {
    return db
        .select({
            id: mitraPrograms.id,
            name: mitraPrograms.name,
            slug: mitraPrograms.slug,
            descriptionMd: mitraPrograms.descriptionMd,
            mechanismMd: mitraPrograms.mechanismMd,
            periodStart: mitraPrograms.periodStart,
            periodEnd: mitraPrograms.periodEnd,
            status: mitraPrograms.status,
            rankingMode: mitraPrograms.rankingMode,
        })
        .from(mitraPrograms)
        .where(and(eq(mitraPrograms.isPublic, true), inArray(mitraPrograms.status, ["ACTIVE", "PUBLISHED", "ENDED"])))
        .orderBy(desc(mitraPrograms.periodStart));
}

/**
 * Menggabungkan baris `mitraProgramScores` (satu baris per outlet/parameter/hari) jadi
 * satu nilai per outlet per parameter, sesuai mode agregasi parameter itu (SUM/AVG/LAST).
 * `points` di setiap baris sudah berbobot (dihitung saat commit import), jadi di sini
 * tinggal digabung -- weight tidak dikalikan ulang. Dipakai bareng oleh halaman publik
 * (tampilan per-parameter) dan recompute leaderboard (total per outlet), supaya
 * keduanya konsisten menghormati mode agregasi tiap parameter.
 */
async function computeOutletParamAggregates(
    programId: string,
    params: { id: string; aggregation: "SUM" | "AVG" | "LAST" }[],
    outletIds: string[]
) {
    const skorRows = outletIds.length > 0 && params.length > 0
        ? await db
            .select({
                outletId: mitraProgramScores.outletId,
                paramId: mitraProgramScores.paramId,
                achievementDate: mitraProgramScores.achievementDate,
                rawValue: mitraProgramScores.rawValue,
                points: mitraProgramScores.points,
            })
            .from(mitraProgramScores)
            .where(and(
                eq(mitraProgramScores.programId, programId),
                inArray(mitraProgramScores.outletId, outletIds)
            ))
        : [];

    const paramById = new Map(params.map((param) => [param.id, param]));
    const kumpulan = new Map<string, { raw: number[]; points: number[]; tanggalTerakhir: string }>();

    for (const skor of skorRows) {
        const kunci = `${skor.outletId}::${skor.paramId}`;
        const param = paramById.get(skor.paramId);
        if (!param) continue;

        const bucket = kumpulan.get(kunci) || { raw: [], points: [], tanggalTerakhir: "" };

        if (param.aggregation === "LAST") {
            // Hanya tanggal terbaru yang dipakai; tanggal lama dibuang saat ketemu yang lebih baru.
            if (skor.achievementDate > bucket.tanggalTerakhir) {
                bucket.tanggalTerakhir = skor.achievementDate;
                bucket.raw = [Number(skor.rawValue)];
                bucket.points = [Number(skor.points)];
            }
        } else {
            bucket.raw.push(Number(skor.rawValue));
            bucket.points.push(Number(skor.points));
            if (skor.achievementDate > bucket.tanggalTerakhir) bucket.tanggalTerakhir = skor.achievementDate;
        }

        kumpulan.set(kunci, bucket);
    }

    const ringkas = (nilai: number[], mode: string) => {
        if (nilai.length === 0) return 0;
        if (mode === "AVG") return nilai.reduce((total, item) => total + item, 0) / nilai.length;
        // SUM dan LAST sama-sama menjumlah; untuk LAST isinya memang tinggal satu nilai.
        return nilai.reduce((total, item) => total + item, 0);
    };

    return {
        get(outletId: string, paramId: string) {
            const bucket = kumpulan.get(`${outletId}::${paramId}`);
            const mode = paramById.get(paramId)?.aggregation || "SUM";
            return {
                raw: ringkas(bucket?.raw || [], mode),
                points: ringkas(bucket?.points || [], mode),
            };
        },
    };
}

export async function getPublicMitraProgramDetail(slug: string, search = "") {
    const [program] = await db
        .select()
        .from(mitraPrograms)
        .where(and(eq(mitraPrograms.slug, slug), eq(mitraPrograms.isPublic, true)))
        .limit(1);

    if (!program) return null;

    const params = await db
        .select()
        .from(mitraProgramParams)
        .where(eq(mitraProgramParams.programId, program.id))
        .orderBy(asc(mitraProgramParams.sortOrder));

    const searchFilter = search
        ? or(
            like(mitraOutlets.name, `%${search}%`),
            like(mitraOutlets.outletCode, `%${search}%`),
            like(mitraOutlets.kecamatan, `%${search}%`),
            like(mitraOutlets.kabupaten, `%${search}%`)
        )
        : undefined;

    const leaderboardWhere = searchFilter
        ? and(eq(mitraProgramLeaderboard.programId, program.id), searchFilter)
        : eq(mitraProgramLeaderboard.programId, program.id);

    const leaderboard = await db
        .select({
            outletId: mitraOutlets.id,
            outletName: mitraOutlets.name,
            outletCode: mitraOutlets.outletCode,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
            totalPoints: mitraProgramLeaderboard.totalPoints,
            rank: mitraProgramLeaderboard.rank,
            prevRank: mitraProgramLeaderboard.prevRank,
            computedAt: mitraProgramLeaderboard.computedAt,
        })
        .from(mitraProgramLeaderboard)
        .innerJoin(mitraOutlets, eq(mitraProgramLeaderboard.outletId, mitraOutlets.id))
        .where(leaderboardWhere)
        .orderBy(asc(mitraProgramLeaderboard.rank))
        .limit(100);

    const winners = await db
        .select({
            outletId: mitraOutlets.id,
            outletName: mitraOutlets.name,
            outletCode: mitraOutlets.outletCode,
            rank: mitraProgramWinners.rank,
            prizeLabel: mitraProgramWinners.prizeLabel,
        })
        .from(mitraProgramWinners)
        .innerJoin(mitraOutlets, eq(mitraProgramWinners.outletId, mitraOutlets.id))
        .where(and(eq(mitraProgramWinners.programId, program.id), eq(mitraProgramWinners.isPublished, true)))
        .orderBy(asc(mitraProgramWinners.rank));

    /**
     * Peserta yang belum punya satu pun skor tidak pernah masuk papan peringkat --
     * peringkat dibangun dari tabel skor. Dari sisi peserta itu terlihat seperti tidak
     * terdaftar, padahal terdaftar. Karena itu mereka ikut ditarik dan digabungkan di
     * bawah daftar dengan nilai nol.
     */
    const peringkatIds = new Set(leaderboard.map((row) => row.outletId));
    const pesertaWhere = searchFilter
        ? and(eq(mitraProgramParticipants.programId, program.id), searchFilter)
        : eq(mitraProgramParticipants.programId, program.id);

    const semuaPeserta = await db
        .select({
            outletId: mitraOutlets.id,
            outletName: mitraOutlets.name,
            outletCode: mitraOutlets.outletCode,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
        })
        .from(mitraProgramParticipants)
        .innerJoin(mitraOutlets, eq(mitraProgramParticipants.outletId, mitraOutlets.id))
        .where(pesertaWhere)
        .orderBy(asc(mitraOutlets.name))
        .limit(200);

    const tanpaSkor = semuaPeserta
        .filter((peserta) => !peringkatIds.has(peserta.outletId))
        .map((peserta) => ({
            ...peserta,
            totalPoints: "0.00",
            rank: null as number | null,
            prevRank: null as number | null,
            computedAt: null as Date | null,
        }));

    const barisTampil = [...leaderboard.map((row) => ({ ...row, rank: row.rank as number | null })), ...tanpaSkor];

    // Pencapaian per parameter, digabung sesuai mode agregasi (SUM/AVG/LAST) masing-masing.
    const outletIds = barisTampil.map((row) => row.outletId);
    const aggregates = await computeOutletParamAggregates(program.id, params, outletIds);

    const barisDenganMetrik = barisTampil.map((row) => ({
        ...row,
        metrics: Object.fromEntries(params.map((param) => [param.key, aggregates.get(row.outletId, param.id)])),
    }));

    return { program, params, leaderboard: barisDenganMetrik, winners };
}

export async function recomputeMitraProgramLeaderboard(programId: string) {
    const participants = await db
        .select({ outletId: mitraProgramParticipants.outletId })
        .from(mitraProgramParticipants)
        .where(eq(mitraProgramParticipants.programId, programId));
    const participantIds = participants.map((participant) => participant.outletId);
    const previousRows = await db
        .select({ outletId: mitraProgramLeaderboard.outletId, rank: mitraProgramLeaderboard.rank })
        .from(mitraProgramLeaderboard)
        .where(eq(mitraProgramLeaderboard.programId, programId));
    const previousRank = new Map(previousRows.map((row) => [row.outletId, row.rank]));

    const params = await db
        .select()
        .from(mitraProgramParams)
        .where(eq(mitraProgramParams.programId, programId))
        .orderBy(asc(mitraProgramParams.sortOrder));

    const scoredOutlets = await db
        .selectDistinct({ outletId: mitraProgramScores.outletId })
        .from(mitraProgramScores)
        .where(and(
            eq(mitraProgramScores.programId, programId),
            participantIds.length > 0 ? inArray(mitraProgramScores.outletId, participantIds) : undefined
        ));
    const outletIds = scoredOutlets.map((row) => row.outletId);

    // Total per outlet = jumlah nilai teragregasi tiap parameter (bukan SUM mentah semua
    // baris), supaya parameter ber-mode AVG/LAST tidak ikut kejumlah per hari.
    const aggregates = await computeOutletParamAggregates(programId, params, outletIds);
    const totals = outletIds
        .map((outletId) => ({
            outletId,
            totalPoints: params.reduce((total, param) => total + aggregates.get(outletId, param.id).points, 0),
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

    const now = new Date();
    await db.delete(mitraProgramLeaderboard).where(eq(mitraProgramLeaderboard.programId, programId));

    if (totals.length === 0) return;

    await db.insert(mitraProgramLeaderboard).values(
        totals.map((row, index) => ({
            id: uuid(),
            programId,
            outletId: row.outletId,
            totalPoints: toDecimalString(row.totalPoints),
            rank: index + 1,
            prevRank: previousRank.get(row.outletId) || null,
            computedAt: now,
        }))
    );
}

/**
 * Mencocokkan leaderboard + pencapaian per parameter terhadap aturan reward program
 * (RANK atau THRESHOLD). Dipanggil setelah recompute, hasilnya preview -- admin masih
 * perlu menyalin ke "Pemenang" dan publish secara sadar sebelum tampil ke publik.
 */
export async function computeMitraProgramRewards(programId: string) {
    const rules = await db
        .select()
        .from(mitraProgramRewardRules)
        .where(eq(mitraProgramRewardRules.programId, programId))
        .orderBy(asc(mitraProgramRewardRules.sortOrder));

    if (rules.length === 0) return [];

    const leaderboard = await db
        .select({
            outletId: mitraOutlets.id,
            outletName: mitraOutlets.name,
            outletCode: mitraOutlets.outletCode,
            totalPoints: mitraProgramLeaderboard.totalPoints,
            rank: mitraProgramLeaderboard.rank,
        })
        .from(mitraProgramLeaderboard)
        .innerJoin(mitraOutlets, eq(mitraProgramLeaderboard.outletId, mitraOutlets.id))
        .where(eq(mitraProgramLeaderboard.programId, programId))
        .orderBy(asc(mitraProgramLeaderboard.rank));

    const needsParamValues = rules.some((rule) => rule.ruleType === "THRESHOLD" && rule.paramKey);
    let aggregates: Awaited<ReturnType<typeof computeOutletParamAggregates>> | null = null;
    let paramByKey = new Map<string, { id: string; aggregation: "SUM" | "AVG" | "LAST" }>();

    if (needsParamValues) {
        const params = await db
            .select()
            .from(mitraProgramParams)
            .where(eq(mitraProgramParams.programId, programId));
        paramByKey = new Map(params.map((param) => [param.key, param]));
        aggregates = await computeOutletParamAggregates(programId, params, leaderboard.map((row) => row.outletId));
    }

    const comparators: Record<string, (value: number, target: number) => boolean> = {
        ">=": (value, target) => value >= target,
        ">": (value, target) => value > target,
        "<=": (value, target) => value <= target,
        "<": (value, target) => value < target,
        "=": (value, target) => value === target,
    };

    const hasil: { outletId: string; outletName: string; outletCode: string; ruleId: string; rewardLabel: string }[] = [];

    for (const rule of rules) {
        if (rule.ruleType === "RANK") {
            const dari = rule.rankFrom ?? 1;
            const sampai = rule.rankTo ?? dari;
            for (const row of leaderboard) {
                if (row.rank !== null && row.rank >= dari && row.rank <= sampai) {
                    hasil.push({ outletId: row.outletId, outletName: row.outletName, outletCode: row.outletCode, ruleId: rule.id, rewardLabel: rule.rewardLabel });
                }
            }
        } else {
            const target = Number(rule.thresholdValue ?? 0);
            const bandingkan = comparators[rule.comparator ?? ">="];
            const param = rule.paramKey ? paramByKey.get(rule.paramKey) : null;

            for (const row of leaderboard) {
                const nilai = rule.paramKey
                    ? (param && aggregates ? aggregates.get(row.outletId, param.id).points : null)
                    : Number(row.totalPoints);
                if (nilai !== null && bandingkan(nilai, target)) {
                    hasil.push({ outletId: row.outletId, outletName: row.outletName, outletCode: row.outletCode, ruleId: rule.id, rewardLabel: rule.rewardLabel });
                }
            }
        }
    }

    return hasil;
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
