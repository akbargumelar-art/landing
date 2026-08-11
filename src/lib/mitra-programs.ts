import { and, asc, desc, eq, gt, inArray, like, or } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import {
    mitraDetailSessions,
    mitraOutlets,
    mitraProgramLeaderboard,
    mitraProgramParams,
    mitraProgramParticipants,
    mitraProgramRewardRules,
    mitraProgramScores,
    mitraPrograms,
    mitraProgramWinners,
    mitraSalesforces,
} from "@/db/schema";
import { hashSessionToken, toDecimalString } from "@/lib/mitra-utils";

export type ProgramTargetType = "OUTLET" | "SALESFORCE";
export type ProgramMechanismType = "RACING" | "REWARD";

export function normalizeTargetType(nilai: unknown): ProgramTargetType {
    return String(nilai || "").toUpperCase() === "SALESFORCE" ? "SALESFORCE" : "OUTLET";
}

export function normalizeMechanismType(nilai: unknown): ProgramMechanismType {
    return String(nilai || "").toUpperCase() === "REWARD" ? "REWARD" : "RACING";
}

/**
 * Menyusun baris aturan hadiah dari isian form. Kolom yang diisi mengikuti mekanisme
 * program: RACING memakai rentang peringkat, REWARD memakai ambang nilai. Kolom milik
 * mekanisme lain sengaja dikosongkan supaya tidak ada sisa data menyesatkan bila
 * mekanismenya kelak diubah.
 */
export function buildRewardRuleValues(
    programId: string,
    mechanismType: ProgramMechanismType,
    rules: Record<string, unknown>[]
) {
    return rules.map((rule, index) => ({
        id: uuid(),
        programId,
        rankFrom: mechanismType === "RACING" && rule.rankFrom ? Number(rule.rankFrom) : null,
        rankTo: mechanismType === "RACING" && rule.rankTo ? Number(rule.rankTo) : null,
        paramKey: mechanismType === "REWARD" && rule.paramKey ? String(rule.paramKey) : null,
        comparator: mechanismType === "REWARD"
            ? ((rule.comparator ? String(rule.comparator) : ">=") as ">=" | ">" | "<=" | "<" | "=")
            : null,
        thresholdValue: mechanismType === "REWARD" && rule.thresholdValue !== undefined && rule.thresholdValue !== null && rule.thresholdValue !== ""
            ? String(rule.thresholdValue)
            : null,
        rewardLabel: String(rule.rewardLabel || `Hadiah ${index + 1}`),
        sortOrder: index,
    }));
}

/**
 * Kunci peserta menggabungkan jenis dan id jadi satu teks. Dipakai sebagai kolom unique
 * karena MySQL menganggap tiap NULL berbeda: unique index pada pasangan (outletId,
 * salesforceId) tidak akan menolak baris salesforce kembar, sebab outletId-nya sama-sama
 * NULL. Satu kolom teks membuat keunikan benar-benar terjaga di level database.
 */
export function participantKeyFor(targetType: ProgramTargetType, id: string): string {
    return targetType === "SALESFORCE" ? `sf:${id}` : `outlet:${id}`;
}

/** Kolom id yang diisi untuk sebuah program, sesuai targetType-nya. */
export function participantColumns(targetType: ProgramTargetType, id: string) {
    return targetType === "SALESFORCE"
        ? { participantKey: participantKeyFor(targetType, id), outletId: null, salesforceId: id }
        : { participantKey: participantKeyFor(targetType, id), outletId: id, salesforceId: null };
}

export type ProgramGroupBy = "NONE" | "TAP" | "KABUPATEN" | "KECAMATAN";

export interface ProgramParticipantInfo {
    participantKey: string;
    id: string;
    code: string;
    name: string;
    /** Wilayah singkat untuk kolom tabel: kabupaten/kecamatan outlet, atau TAP salesforce. */
    area: string;
    tap: string;
    kabupaten: string;
    kecamatan: string;
}

export function normalizeGroupBy(nilai: unknown): ProgramGroupBy {
    const teks = String(nilai || "").toUpperCase();
    return teks === "TAP" || teks === "KABUPATEN" || teks === "KECAMATAN" ? teks : "NONE";
}

/**
 * Nilai wilayah yang dipakai sebagai pembagi liga. Peserta yang wilayahnya kosong
 * dikumpulkan ke "(Tanpa <wilayah>)" alih-alih dibuang, supaya tidak diam-diam hilang
 * dari papan peringkat hanya karena datanya belum lengkap.
 */
export function groupValueOf(info: ProgramParticipantInfo, groupBy: ProgramGroupBy): string {
    if (groupBy === "NONE") return "";
    const nilai = groupBy === "TAP" ? info.tap : groupBy === "KABUPATEN" ? info.kabupaten : info.kecamatan;
    return nilai.trim() || `(Tanpa ${groupBy.charAt(0)}${groupBy.slice(1).toLowerCase()})`;
}

/**
 * Daftar peserta terdaftar beserta identitasnya, diambil dari tabel outlet atau
 * salesforce sesuai targetType. Satu fungsi untuk dua jenis peserta supaya halaman admin
 * dan publik tidak perlu bercabang tiap kali butuh nama peserta.
 */
export async function listProgramParticipants(programId: string, targetType: ProgramTargetType): Promise<ProgramParticipantInfo[]> {
    if (targetType === "SALESFORCE") {
        const rows = await db
            .select({
                participantKey: mitraProgramParticipants.participantKey,
                id: mitraSalesforces.id,
                name: mitraSalesforces.name,
                tap: mitraSalesforces.tap,
            })
            .from(mitraProgramParticipants)
            .innerJoin(mitraSalesforces, eq(mitraProgramParticipants.salesforceId, mitraSalesforces.id))
            .where(eq(mitraProgramParticipants.programId, programId))
            .orderBy(asc(mitraSalesforces.name));

        // Salesforce tidak punya kode terpisah; namanya sendiri yang unik dan dipakai
        // sebagai identitas di berkas upload.
        return rows.map((row) => ({
            participantKey: row.participantKey,
            id: row.id,
            code: row.name,
            name: row.name,
            area: row.tap || "",
            tap: row.tap || "",
            kabupaten: "",
            kecamatan: "",
        }));
    }

    const rows = await db
        .select({
            participantKey: mitraProgramParticipants.participantKey,
            id: mitraOutlets.id,
            code: mitraOutlets.outletCode,
            name: mitraOutlets.name,
            tap: mitraOutlets.tap,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
        })
        .from(mitraProgramParticipants)
        .innerJoin(mitraOutlets, eq(mitraProgramParticipants.outletId, mitraOutlets.id))
        .where(eq(mitraProgramParticipants.programId, programId))
        .orderBy(asc(mitraOutlets.name));

    return rows.map((row) => ({
        participantKey: row.participantKey,
        id: row.id,
        code: row.code,
        name: row.name,
        area: [row.kecamatan, row.kabupaten].filter(Boolean).join(", "),
        tap: row.tap || "",
        kabupaten: row.kabupaten || "",
        kecamatan: row.kecamatan || "",
    }));
}

/**
 * Mencocokkan kode peserta dari berkas upload ke id-nya. Untuk outlet dicocokkan pada
 * outletCode, untuk salesforce pada nama (identitas uniknya).
 */
export async function resolveParticipantCodes(targetType: ProgramTargetType, codes: string[]) {
    const bersih = Array.from(new Set(codes.map((code) => code.trim()).filter(Boolean)));
    if (bersih.length === 0) return new Map<string, { id: string; name: string }>();

    if (targetType === "SALESFORCE") {
        const rows = await db
            .select({ id: mitraSalesforces.id, code: mitraSalesforces.name, name: mitraSalesforces.name })
            .from(mitraSalesforces)
            .where(inArray(mitraSalesforces.name, bersih));
        return new Map(rows.map((row) => [row.code, { id: row.id, name: row.name }]));
    }

    const rows = await db
        .select({ id: mitraOutlets.id, code: mitraOutlets.outletCode, name: mitraOutlets.name })
        .from(mitraOutlets)
        .where(inArray(mitraOutlets.outletCode, bersih));
    return new Map(rows.map((row) => [row.code, { id: row.id, name: row.name }]));
}

/** Identitas ringkas untuk picker admin; tidak membawa kolom wilayah pembagi liga. */
export interface ParticipantCandidate {
    id: string;
    code: string;
    name: string;
    area: string;
}

export interface ParticipantFilter {
    /** Daftar kode/nama yang ditempel admin. Kalau diisi, filter wilayah diabaikan. */
    codes?: string[];
    tap?: string;
    kabupaten?: string;
    kecamatan?: string;
    category?: string;
}

/**
 * Mencari calon peserta dalam jumlah besar sekaligus -- baik dari daftar kode yang
 * ditempel maupun dari filter wilayah. Dipakai untuk menambahkan peserta massal tanpa
 * harus mengetikkan satu per satu di kotak pencarian.
 *
 * Mengembalikan juga `unknown`: kode yang tidak cocok dengan data mana pun dilaporkan
 * balik, bukan dibuang diam-diam, supaya admin tahu ada baris yang tidak masuk.
 */
export async function findParticipantsBulk(
    targetType: ProgramTargetType,
    filter: ParticipantFilter
): Promise<{ candidates: ParticipantCandidate[]; unknown: string[] }> {
    const codes = Array.from(new Set((filter.codes || []).map((code) => code.trim()).filter(Boolean)));
    const pakaiKode = codes.length > 0;

    if (targetType === "SALESFORCE") {
        const syarat = [eq(mitraSalesforces.isActive, true)];
        if (pakaiKode) syarat.push(inArray(mitraSalesforces.name, codes));
        else if (filter.tap) syarat.push(eq(mitraSalesforces.tap, filter.tap));

        const rows = await db
            .select({ id: mitraSalesforces.id, name: mitraSalesforces.name, tap: mitraSalesforces.tap })
            .from(mitraSalesforces)
            .where(and(...syarat))
            .orderBy(asc(mitraSalesforces.name))
            .limit(2000);

        const ketemu = new Set(rows.map((row) => row.name));
        return {
            candidates: rows.map((row) => ({ id: row.id, code: row.name, name: row.name, area: row.tap || "" })),
            unknown: pakaiKode ? codes.filter((code) => !ketemu.has(code)) : [],
        };
    }

    const syarat = [eq(mitraOutlets.status, "ACTIVE" as const)];
    if (pakaiKode) {
        syarat.push(inArray(mitraOutlets.outletCode, codes));
    } else {
        if (filter.tap) syarat.push(eq(mitraOutlets.tap, filter.tap));
        if (filter.kabupaten) syarat.push(eq(mitraOutlets.kabupaten, filter.kabupaten));
        if (filter.kecamatan) syarat.push(eq(mitraOutlets.kecamatan, filter.kecamatan));
        if (filter.category) syarat.push(eq(mitraOutlets.category, filter.category as "FISIK"));
    }

    const rows = await db
        .select({
            id: mitraOutlets.id,
            code: mitraOutlets.outletCode,
            name: mitraOutlets.name,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
        })
        .from(mitraOutlets)
        .where(and(...syarat))
        .orderBy(asc(mitraOutlets.name))
        .limit(5000);

    const ketemu = new Set(rows.map((row) => row.code));
    return {
        candidates: rows.map((row) => ({
            id: row.id,
            code: row.code,
            name: row.name,
            area: [row.kecamatan, row.kabupaten].filter(Boolean).join(", "),
        })),
        unknown: pakaiKode ? codes.filter((code) => !ketemu.has(code)) : [],
    };
}

/**
 * Menggabungkan baris skor (satu baris per peserta/parameter/hari) jadi satu nilai per
 * peserta per parameter, sesuai mode agregasi parameter itu (SUM/AVG/LAST).
 *
 * Digabung di JavaScript, bukan lewat SQL, karena LAST berarti "ambil tanggal terbaru" --
 * tidak ada satu fungsi agregat SQL yang mewakilinya.
 *
 * Poin dihitung di sini dari nilai mentah x bobot yang BERLAKU SEKARANG, bukan dibaca dari
 * kolom points hasil unggahan. Bobot dan status "informasi" bisa diubah admin kapan saja;
 * kalau poin lama yang dipakai, mengubah bobot tidak akan berpengaruh apa-apa sampai
 * seluruh berkas diunggah ulang.
 */
export async function computeParticipantParamAggregates(
    programId: string,
    params: { id: string; aggregation: "SUM" | "AVG" | "LAST"; weight: string; isScored: boolean }[],
    participantKeys: string[]
) {
    const skorRows = participantKeys.length > 0 && params.length > 0
        ? await db
            .select({
                participantKey: mitraProgramScores.participantKey,
                paramId: mitraProgramScores.paramId,
                achievementDate: mitraProgramScores.achievementDate,
                rawValue: mitraProgramScores.rawValue,
            })
            .from(mitraProgramScores)
            .where(and(
                eq(mitraProgramScores.programId, programId),
                inArray(mitraProgramScores.participantKey, participantKeys)
            ))
        : [];

    const paramById = new Map(params.map((param) => [param.id, param]));
    const kumpulan = new Map<string, { raw: number[]; tanggalTerakhir: string }>();

    for (const skor of skorRows) {
        const param = paramById.get(skor.paramId);
        if (!param) continue;

        const kunci = `${skor.participantKey}::${skor.paramId}`;
        const bucket = kumpulan.get(kunci) || { raw: [], tanggalTerakhir: "" };

        if (param.aggregation === "LAST") {
            // Tanggal disimpan sebagai teks ISO, jadi perbandingan teks sudah urut benar.
            if (skor.achievementDate > bucket.tanggalTerakhir) {
                bucket.tanggalTerakhir = skor.achievementDate;
                bucket.raw = [Number(skor.rawValue)];
            }
        } else {
            bucket.raw.push(Number(skor.rawValue));
            if (skor.achievementDate > bucket.tanggalTerakhir) bucket.tanggalTerakhir = skor.achievementDate;
        }

        kumpulan.set(kunci, bucket);
    }

    const ringkas = (nilai: number[], mode: string) => {
        if (nilai.length === 0) return 0;
        if (mode === "AVG") return nilai.reduce((total, item) => total + item, 0) / nilai.length;
        // SUM dan LAST sama-sama menjumlah; pada LAST isinya memang tinggal satu nilai.
        return nilai.reduce((total, item) => total + item, 0);
    };

    return {
        get(participantKey: string, paramId: string) {
            const bucket = kumpulan.get(`${participantKey}::${paramId}`);
            const param = paramById.get(paramId);
            const raw = ringkas(bucket?.raw || [], param?.aggregation || "SUM");
            // Parameter informasi tidak pernah berpoin, berapa pun bobot yang tersimpan.
            const bobot = param && param.isScored ? Number(param.weight) || 0 : 0;
            return { raw, points: raw * bobot };
        },
    };
}

/**
 * Menghitung ulang papan peringkat. Total tiap peserta adalah jumlah nilai TERAGREGASI
 * tiap parameter -- bukan SUM mentah semua baris -- supaya parameter bermode AVG/LAST
 * tidak ikut terjumlah per hari.
 */
export async function recomputeProgramLeaderboard(programId: string) {
    const [program] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, programId)).limit(1);
    if (!program) return;

    const targetType = program.targetType as ProgramTargetType;
    const groupBy = program.groupBy as ProgramGroupBy;

    const [params, participants, previousRows] = await Promise.all([
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, programId)).orderBy(asc(mitraProgramParams.sortOrder)),
        listProgramParticipants(programId, targetType),
        db
            .select({ participantKey: mitraProgramLeaderboard.participantKey, rank: mitraProgramLeaderboard.rank })
            .from(mitraProgramLeaderboard)
            .where(eq(mitraProgramLeaderboard.programId, programId)),
    ]);

    const previousRank = new Map(previousRows.map((row) => [row.participantKey, row.rank]));
    const aggregates = await computeParticipantParamAggregates(
        programId,
        params,
        participants.map((row) => row.participantKey)
    );

    /**
     * Peringkat dihitung di dalam tiap kelompok, bukan sekali untuk seluruh peserta.
     * Dengan begitu program yang dibagi per TAP menghasilkan juara 1 di setiap TAP, dan
     * aturan hadiah berbasis peringkat langsung berlaku per wilayah tanpa aturan terpisah.
     */
    // Parameter bertanda informasi ikut ditampilkan di tabel tetapi tidak menambah poin.
    const paramsDinilai = params.filter((param) => param.isScored);

    const perGroup = new Map<string, { info: ProgramParticipantInfo; totalPoints: number }[]>();
    for (const peserta of participants) {
        const groupKey = groupValueOf(peserta, groupBy);
        const totalPoints = paramsDinilai.reduce((total, param) => total + aggregates.get(peserta.participantKey, param.id).points, 0);
        const daftar = perGroup.get(groupKey) || [];
        daftar.push({ info: peserta, totalPoints });
        perGroup.set(groupKey, daftar);
    }

    const now = new Date();
    const baris: (typeof mitraProgramLeaderboard.$inferInsert)[] = [];

    for (const [groupKey, daftar] of perGroup) {
        daftar.sort((a, b) => b.totalPoints - a.totalPoints);
        daftar.forEach((item, index) => {
            baris.push({
                id: uuid(),
                programId,
                ...participantColumns(targetType, item.info.id),
                totalPoints: toDecimalString(item.totalPoints),
                groupKey,
                rank: index + 1,
                prevRank: previousRank.get(item.info.participantKey) ?? null,
                computedAt: now,
            });
        });
    }

    await db.delete(mitraProgramLeaderboard).where(eq(mitraProgramLeaderboard.programId, programId));
    if (baris.length > 0) await db.insert(mitraProgramLeaderboard).values(baris);
}

export interface RewardMatch {
    participantKey: string;
    code: string;
    name: string;
    rank: number | null;
    groupKey: string;
    rewardLabel: string;
    ruleId: string;
}

/**
 * Mencocokkan peserta dengan aturan hadiah. Kolom aturan mana yang dipakai ditentukan
 * oleh mechanismType program: RACING membaca rentang peringkat, REWARD membaca ambang
 * nilai. Hasilnya hanya usulan -- admin masih harus menyetujui dan mempublikasikannya.
 */
export async function computeProgramRewards(programId: string): Promise<RewardMatch[]> {
    const [program] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, programId)).limit(1);
    if (!program) return [];

    const rules = await db
        .select()
        .from(mitraProgramRewardRules)
        .where(eq(mitraProgramRewardRules.programId, programId))
        .orderBy(asc(mitraProgramRewardRules.sortOrder));
    if (rules.length === 0) return [];

    const targetType = program.targetType as ProgramTargetType;
    const groupBy = program.groupBy as ProgramGroupBy;
    const peserta = await listProgramParticipants(programId, targetType);
    const pesertaByKey = new Map(peserta.map((item) => [item.participantKey, item]));

    const leaderboard = await db
        .select({
            participantKey: mitraProgramLeaderboard.participantKey,
            totalPoints: mitraProgramLeaderboard.totalPoints,
            groupKey: mitraProgramLeaderboard.groupKey,
            rank: mitraProgramLeaderboard.rank,
        })
        .from(mitraProgramLeaderboard)
        .where(eq(mitraProgramLeaderboard.programId, programId))
        .orderBy(asc(mitraProgramLeaderboard.groupKey), asc(mitraProgramLeaderboard.rank));

    const hasil: RewardMatch[] = [];

    if (program.mechanismType === "RACING") {
        for (const rule of rules) {
            const dari = rule.rankFrom ?? 1;
            const sampai = rule.rankTo ?? dari;
            for (const row of leaderboard) {
                const info = pesertaByKey.get(row.participantKey);
                if (!info || row.rank < dari || row.rank > sampai) continue;
                hasil.push({
                    participantKey: row.participantKey,
                    code: info.code,
                    name: info.name,
                    rank: row.rank,
                    groupKey: row.groupKey,
                    rewardLabel: rule.rewardLabel,
                    ruleId: rule.id,
                });
            }
        }
        return hasil;
    }

    // REWARD: tidak ada peringkat yang menentukan; setiap peserta yang melewati ambang
    // mendapat hadiahnya, dan satu aturan boleh menghasilkan banyak penerima.
    const params = await db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, programId));
    const paramByKey = new Map(params.map((param) => [param.key, param]));
    const aggregates = await computeParticipantParamAggregates(programId, params, peserta.map((item) => item.participantKey));
    const totalByKey = new Map(leaderboard.map((row) => [row.participantKey, Number(row.totalPoints)]));

    const bandingkan: Record<string, (nilai: number, target: number) => boolean> = {
        ">=": (nilai, target) => nilai >= target,
        ">": (nilai, target) => nilai > target,
        "<=": (nilai, target) => nilai <= target,
        "<": (nilai, target) => nilai < target,
        "=": (nilai, target) => nilai === target,
    };

    for (const rule of rules) {
        const target = Number(rule.thresholdValue ?? 0);
        const cocok = bandingkan[rule.comparator ?? ">="];
        const param = rule.paramKey ? paramByKey.get(rule.paramKey) : null;
        // paramKey yang diisi tapi tidak dikenal berarti aturannya menunjuk parameter yang
        // sudah dihapus -- dilewati, bukan diperlakukan sebagai nilai nol.
        if (rule.paramKey && !param) continue;

        for (const info of peserta) {
            const nilai = param
                ? aggregates.get(info.participantKey, param.id).raw
                : totalByKey.get(info.participantKey) ?? 0;
            if (!cocok(nilai, target)) continue;
            hasil.push({
                participantKey: info.participantKey,
                code: info.code,
                name: info.name,
                rank: null,
                groupKey: groupValueOf(info, groupBy),
                rewardLabel: rule.rewardLabel,
                ruleId: rule.id,
            });
        }
    }

    return hasil;
}

/** Daftar program yang boleh tampil publik, disaring per jenis peserta. */
export async function getPublicPrograms(targetType: ProgramTargetType) {
    return db
        .select({
            id: mitraPrograms.id,
            name: mitraPrograms.name,
            slug: mitraPrograms.slug,
            mechanismType: mitraPrograms.mechanismType,
            thumbnailUrl: mitraPrograms.thumbnailUrl,
            descriptionMd: mitraPrograms.descriptionMd,
            periodStart: mitraPrograms.periodStart,
            periodEnd: mitraPrograms.periodEnd,
            status: mitraPrograms.status,
        })
        .from(mitraPrograms)
        .where(and(
            eq(mitraPrograms.isPublic, true),
            eq(mitraPrograms.targetType, targetType),
            inArray(mitraPrograms.status, ["ACTIVE", "PUBLISHED", "ENDED"])
        ))
        .orderBy(desc(mitraPrograms.periodStart));
}

/**
 * Detail satu program untuk halaman publik: mekanisme, parameter, papan peringkat
 * lengkap dengan pencapaian per parameter, dan pemenang yang sudah dipublikasikan.
 */
export async function getPublicProgramDetail(slug: string, targetType: ProgramTargetType, search = "") {
    const [program] = await db
        .select()
        .from(mitraPrograms)
        .where(and(
            eq(mitraPrograms.slug, slug),
            eq(mitraPrograms.targetType, targetType),
            eq(mitraPrograms.isPublic, true)
        ))
        .limit(1);

    if (!program) return null;

    const params = await db
        .select()
        .from(mitraProgramParams)
        .where(eq(mitraProgramParams.programId, program.id))
        .orderBy(asc(mitraProgramParams.sortOrder));

    const groupBy = program.groupBy as ProgramGroupBy;
    const peserta = await listProgramParticipants(program.id, targetType);
    const pesertaByKey = new Map(peserta.map((item) => [item.participantKey, item]));

    // Aturan hadiah ikut dikirim ke publik supaya peserta tahu apa yang diperebutkan --
    // sebelumnya hadiah hanya terlihat setelah pemenang diumumkan, yang sudah terlambat
    // untuk memotivasi siapa pun.
    const rewardRules = await db
        .select({
            id: mitraProgramRewardRules.id,
            rankFrom: mitraProgramRewardRules.rankFrom,
            rankTo: mitraProgramRewardRules.rankTo,
            paramKey: mitraProgramRewardRules.paramKey,
            comparator: mitraProgramRewardRules.comparator,
            thresholdValue: mitraProgramRewardRules.thresholdValue,
            rewardLabel: mitraProgramRewardRules.rewardLabel,
        })
        .from(mitraProgramRewardRules)
        .where(eq(mitraProgramRewardRules.programId, program.id))
        .orderBy(asc(mitraProgramRewardRules.sortOrder));

    const leaderboardRows = await db
        .select({
            participantKey: mitraProgramLeaderboard.participantKey,
            totalPoints: mitraProgramLeaderboard.totalPoints,
            groupKey: mitraProgramLeaderboard.groupKey,
            rank: mitraProgramLeaderboard.rank,
            prevRank: mitraProgramLeaderboard.prevRank,
            computedAt: mitraProgramLeaderboard.computedAt,
        })
        .from(mitraProgramLeaderboard)
        .where(eq(mitraProgramLeaderboard.programId, program.id))
        .orderBy(asc(mitraProgramLeaderboard.groupKey), asc(mitraProgramLeaderboard.rank));

    const aggregates = await computeParticipantParamAggregates(program.id, params, peserta.map((item) => item.participantKey));

    /**
     * Peserta tanpa satu pun skor tidak pernah muncul di papan peringkat. Dari sisi mereka
     * itu terlihat seperti tidak terdaftar, padahal terdaftar -- karena itu digabungkan di
     * bawah daftar dengan nilai nol dan peringkat kosong.
     */
    const adaDiPeringkat = new Set(leaderboardRows.map((row) => row.participantKey));
    const baris = [
        ...leaderboardRows.map((row) => ({
            participantKey: row.participantKey,
            totalPoints: Number(row.totalPoints),
            groupKey: row.groupKey,
            rank: row.rank as number | null,
            prevRank: row.prevRank,
            computedAt: row.computedAt as Date | null,
        })),
        ...peserta
            .filter((item) => !adaDiPeringkat.has(item.participantKey))
            .map((item) => ({
                participantKey: item.participantKey,
                totalPoints: 0,
                groupKey: groupValueOf(item, groupBy),
                rank: null as number | null,
                prevRank: null as number | null,
                computedAt: null as Date | null,
            })),
    ];

    const kataKunci = search.trim().toLowerCase();
    const leaderboard = baris
        .map((row) => {
            const info = pesertaByKey.get(row.participantKey);
            return {
                ...row,
                code: info?.code || "",
                name: info?.name || "",
                area: info?.area || "",
                metrics: Object.fromEntries(params.map((param) => [param.key, aggregates.get(row.participantKey, param.id)])),
            };
        })
        .filter((row) => !kataKunci
            || row.code.toLowerCase().includes(kataKunci)
            || row.name.toLowerCase().includes(kataKunci)
            || row.area.toLowerCase().includes(kataKunci));

    const winnerRows = await db
        .select({
            participantKey: mitraProgramWinners.participantKey,
            groupKey: mitraProgramWinners.groupKey,
            rank: mitraProgramWinners.rank,
            prizeLabel: mitraProgramWinners.prizeLabel,
        })
        .from(mitraProgramWinners)
        .where(and(eq(mitraProgramWinners.programId, program.id), eq(mitraProgramWinners.isPublished, true)))
        .orderBy(asc(mitraProgramWinners.rank));

    const winners = winnerRows.map((row) => {
        const info = pesertaByKey.get(row.participantKey);
        return {
            participantKey: row.participantKey,
            code: info?.code || "",
            name: info?.name || "",
            groupKey: row.groupKey,
            rank: row.rank,
            prizeLabel: row.prizeLabel,
        };
    });

    // Daftar wilayah diambil dari seluruh peserta, bukan dari hasil pencarian, supaya
    // pilihan filter tidak menyusut ketika pengunjung sedang menyaring tabel.
    const groups = groupBy === "NONE"
        ? []
        : Array.from(new Set(peserta.map((item) => groupValueOf(item, groupBy)))).sort((a, b) => a.localeCompare(b, "id"));

    return { program, params, leaderboard, winners, rewardRules, groups };
}

/**
 * Memastikan sesi OTP yang dibawa pengunjung memang untuk program ini. Satu cookie hanya
 * memuat satu token, jadi membuka program lain menuntut verifikasi ulang -- itu disengaja:
 * hak akses diberikan per program, bukan sekali untuk semuanya.
 */
export async function hasValidProgramSession(programId: string, sessionToken: string | undefined) {
    if (!sessionToken) return false;

    const [session] = await db
        .select({ id: mitraDetailSessions.id })
        .from(mitraDetailSessions)
        .where(and(
            eq(mitraDetailSessions.tokenHash, hashSessionToken(sessionToken)),
            eq(mitraDetailSessions.programId, programId),
            gt(mitraDetailSessions.expiresAt, new Date())
        ))
        .limit(1);

    return Boolean(session);
}

/** Pencarian peserta untuk picker di halaman admin, seragam untuk kedua jenis program. */
export async function searchParticipantCandidates(targetType: ProgramTargetType, query: string, limit = 8) {
    const q = query.trim();
    if (!q) return [];

    if (targetType === "SALESFORCE") {
        const rows = await db
            .select({ id: mitraSalesforces.id, name: mitraSalesforces.name, tap: mitraSalesforces.tap })
            .from(mitraSalesforces)
            .where(and(eq(mitraSalesforces.isActive, true), like(mitraSalesforces.name, `%${q}%`)))
            .orderBy(asc(mitraSalesforces.name))
            .limit(limit);
        return rows.map((row) => ({ id: row.id, code: row.name, name: row.name, area: row.tap || "" }));
    }

    const rows = await db
        .select({
            id: mitraOutlets.id,
            code: mitraOutlets.outletCode,
            name: mitraOutlets.name,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
        })
        .from(mitraOutlets)
        .where(or(like(mitraOutlets.name, `%${q}%`), like(mitraOutlets.outletCode, `%${q}%`)))
        .orderBy(asc(mitraOutlets.name))
        .limit(limit);
    return rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        area: [row.kecamatan, row.kabupaten].filter(Boolean).join(", "),
    }));
}
