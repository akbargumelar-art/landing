import { and, asc, count, desc, eq, gt, inArray, like, or, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import {
    mitraDetailSessions,
    mitraImportBatches,
    mitraMetricDefs,
    mitraOutletDetails,
    mitraOutletMetrics,
    mitraOutlets,
    mitraProgramLeaderboard,
    mitraProgramParams,
    mitraProgramParticipants,
    mitraProgramScores,
    mitraPrograms,
    mitraProgramWinners,
    mitraTerritories,
    mitraWhitelistNumbers,
    mitraWhitelistUsageLogs,
} from "@/db/schema";
import {
    hashSessionToken,
    isFuture,
    maskPhone,
    normalizePhoneE164,
    toDecimalString,
} from "@/lib/mitra-utils";

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
            salesforce: mitraOutlets.salesforce,
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
            territoryName: mitraTerritories.name,
            territoryId: mitraOutlets.territoryId,
        })
        .from(mitraOutlets)
        .leftJoin(mitraTerritories, eq(mitraOutlets.territoryId, mitraTerritories.id))
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
        photoUrl: row.photoUrl,
        territoryName: row.territoryName,
        ownerPhoneMasked: maskPhone(row.ownerPhone),
    };
}

export async function getOutletDetailWithSession(publicToken: string, sessionToken: string | undefined) {
    if (!sessionToken) return null;

    const outletRecord = await getMitraOutletRecordByToken(publicToken);
    const outlet = await getPublicOutletByToken(publicToken);
    if (!outletRecord) return null;
    if (!outlet) return null;

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

    if (!detailSession) return null;

    const [detailRow] = await db
        .select({
            ownerPhone: mitraOutlets.ownerPhone,
            sellthruDigiposJson: mitraOutletDetails.sellthruDigiposJson,
            sellthruNotaJson: mitraOutletDetails.sellthruNotaJson,
            rechargeDigiposJson: mitraOutletDetails.rechargeDigiposJson,
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

    return {
        outlet: {
            ...outlet,
            ownerName: outletRecord.ownerName,
            rsNumber: outletRecord.rsNumber,
            tap: outletRecord.tap,
            salesforce: outletRecord.salesforce,
            longitude: outletRecord.longitude,
            latitude: outletRecord.latitude,
            locationUrl: outletRecord.locationUrl,
            territoryId: outletRecord.territoryId,
        },
        detailSession,
        details: {
            ownerPhone: detailRow?.ownerPhone || "",
            sellthruDigipos: detailRow?.sellthruDigiposJson || {},
            sellthruNota: detailRow?.sellthruNotaJson || {},
            rechargeDigipos: detailRow?.rechargeDigiposJson || {},
        },
        performance,
    };
}

export async function findMatchingWhitelist(phone: string, outlet: { id: string; territoryId: string | null }) {
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
        if (candidate.scope === "TERRITORY") return Boolean(outlet.territoryId && candidate.territoryId === outlet.territoryId);
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

    return { program, params, leaderboard, winners };
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

    const rows = await db
        .select({
            outletId: mitraProgramScores.outletId,
            totalPoints: sql<string>`sum(${mitraProgramScores.points})`,
        })
        .from(mitraProgramScores)
        .where(and(
            eq(mitraProgramScores.programId, programId),
            participantIds.length > 0 ? inArray(mitraProgramScores.outletId, participantIds) : undefined
        ))
        .groupBy(mitraProgramScores.outletId)
        .orderBy(desc(sql`sum(${mitraProgramScores.points})`));

    const now = new Date();
    await db.delete(mitraProgramLeaderboard).where(eq(mitraProgramLeaderboard.programId, programId));

    if (rows.length === 0) return;

    await db.insert(mitraProgramLeaderboard).values(
        rows.map((row, index) => ({
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
