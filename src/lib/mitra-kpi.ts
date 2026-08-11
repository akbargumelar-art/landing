import { asc, eq, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import {
    mitraKpiOutletScores,
    mitraKpiResults,
    mitraKpiTargets,
    mitraOutlets,
    mitraProgramParams,
    mitraProgramParticipants,
    mitraProgramRewardRules,
    mitraPrograms,
    mitraSalesforces,
} from "@/db/schema";
import { toDecimalString } from "@/lib/mitra-utils";

export type KpiCategory = "NONE" | "COMPLIANCE" | "PERFORMANCE";
export type KpiPolarity = "HIGHER_BETTER" | "LOWER_BETTER";
export type KpiAggregation = "SUM" | "AVG" | "LAST";
export type KpiBenefitType = "NONE" | "REWARD" | "PUNISHMENT";
export type KpiScoreSource = "TOTAL" | "COMPLIANCE" | "PERFORMANCE";
export type KpiComparator = ">=" | ">" | "<=" | "<" | "=";

export interface KpiParamInput {
    id: string;
    key: string;
    label: string;
    unit?: string | null;
    category: KpiCategory;
    aggregation: KpiAggregation;
    weight: number;
    cap: number | null;
    polarity: KpiPolarity;
}

export interface KpiRuleInput {
    id: string;
    scoreSource: KpiScoreSource;
    comparator: KpiComparator;
    threshold: number;
    benefitType: KpiBenefitType;
    label: string;
    sortOrder: number;
}

export interface KpiRawValue {
    outletId: string;
    rawValue: number;
    achievementDate: string;
}

export interface KpiParamResult {
    id: string;
    key: string;
    label: string;
    unit?: string | null;
    category: KpiCategory;
    aggregation: KpiAggregation;
    target: number | null;
    actual: number;
    achievement: number | null;
    gap: number | null;
    weight: number;
    cap: number | null;
    capped: boolean;
    score: number | null;
    polarity: KpiPolarity;
}

export interface KpiEvaluation {
    params: KpiParamResult[];
    complianceScore: number;
    performanceScore: number;
    compliancePassed: boolean;
    benefitType: KpiBenefitType;
    benefitLabel: string;
    benefitRuleId: string | null;
    missingTargetCount: number;
}

const finite = (value: number) => Number.isFinite(value) ? value : 0;
const nonNegative = (value: number) => Math.max(0, finite(value));

export function calculateAchievement(
    actual: number,
    target: number,
    polarity: KpiPolarity,
    cap: number | null
) {
    const actualValue = nonNegative(actual);
    const targetValue = nonNegative(target);
    let uncapped: number;

    if (polarity === "LOWER_BETTER") {
        uncapped = actualValue > 0
            ? (targetValue / actualValue) * 100
            : targetValue > 0 ? (cap ?? 100) : 100;
    } else {
        uncapped = targetValue > 0
            ? (actualValue / targetValue) * 100
            : actualValue > 0 ? 100 : 0;
    }

    uncapped = nonNegative(uncapped);
    const achievement = cap === null ? uncapped : Math.min(uncapped, cap);
    return { achievement, capped: cap !== null && uncapped > cap };
}

export function calculateGap(actual: number, target: number, polarity: KpiPolarity) {
    return polarity === "LOWER_BETTER" ? target - actual : actual - target;
}

export function compareKpi(value: number, comparator: KpiComparator, threshold: number) {
    if (comparator === ">") return value > threshold;
    if (comparator === "<=") return value <= threshold;
    if (comparator === "<") return value < threshold;
    if (comparator === "=") return value === threshold;
    return value >= threshold;
}

/**
 * Menggabungkan pencapaian outlet menjadi aktual seorang SF. AVG dihitung per outlet
 * lebih dulu lalu dirata-rata bersama outlet tanpa data (nilai 0), sehingga outlet yang
 * tidak dikunjungi tidak menghilang dari pembagi. LAST mengambil nilai terakhir tiap
 * outlet lalu menjumlahkannya.
 */
export function aggregateKpiActual(
    rows: KpiRawValue[],
    outletIds: string[],
    aggregation: KpiAggregation
) {
    if (aggregation === "SUM") {
        return rows.reduce((total, row) => total + finite(row.rawValue), 0);
    }

    const byOutlet = new Map<string, KpiRawValue[]>();
    for (const outletId of outletIds) byOutlet.set(outletId, []);
    for (const row of rows) {
        const bucket = byOutlet.get(row.outletId) || [];
        bucket.push(row);
        byOutlet.set(row.outletId, bucket);
    }

    if (aggregation === "LAST") {
        let total = 0;
        for (const bucket of byOutlet.values()) {
            const latest = [...bucket].sort((a, b) => b.achievementDate.localeCompare(a.achievementDate))[0];
            total += latest ? finite(latest.rawValue) : 0;
        }
        return total;
    }

    if (byOutlet.size === 0) return 0;
    let total = 0;
    for (const bucket of byOutlet.values()) {
        total += bucket.length > 0
            ? bucket.reduce((sum, row) => sum + finite(row.rawValue), 0) / bucket.length
            : 0;
    }
    return total / byOutlet.size;
}

export function evaluateKpi(
    params: KpiParamInput[],
    targets: Map<string, number>,
    actuals: Map<string, number>,
    rules: KpiRuleInput[],
    complianceMinScore: number | null
): KpiEvaluation {
    const details: KpiParamResult[] = params
        .filter((param) => param.category !== "NONE")
        .map((param) => {
            const target = targets.has(param.id) ? finite(targets.get(param.id)!) : null;
            const actual = finite(actuals.get(param.id) || 0);
            if (target === null) {
                return {
                    ...param,
                    target: null,
                    actual,
                    achievement: null,
                    gap: null,
                    capped: false,
                    score: null,
                };
            }
            const { achievement, capped } = calculateAchievement(actual, target, param.polarity, param.cap);
            return {
                ...param,
                target,
                actual,
                achievement,
                gap: calculateGap(actual, target, param.polarity),
                capped,
                score: param.category === "PERFORMANCE" ? (achievement * param.weight) / 100 : achievement,
            };
        });

    const compliance = details.filter((item) => item.category === "COMPLIANCE" && item.achievement !== null);
    const complianceWeighted = compliance.filter((item) => item.weight > 0);
    const complianceScore = compliance.length === 0
        ? 100
        : complianceWeighted.length > 0
            ? complianceWeighted.reduce((sum, item) => sum + item.achievement! * item.weight, 0)
                / complianceWeighted.reduce((sum, item) => sum + item.weight, 0)
            : compliance.reduce((sum, item) => sum + item.achievement!, 0) / compliance.length;

    const performance = details.filter((item) => item.category === "PERFORMANCE" && item.achievement !== null);
    const performanceScore = performance.reduce((sum, item) => sum + item.achievement! * item.weight, 0) / 100;
    const compliancePassed = complianceMinScore === null || complianceScore >= complianceMinScore;

    const sortedRules = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
    let matched: KpiRuleInput | undefined;
    if (!compliancePassed) {
        matched = sortedRules.find((rule) =>
            rule.scoreSource === "COMPLIANCE" && compareKpi(complianceScore, rule.comparator, rule.threshold));
    } else {
        matched = sortedRules.find((rule) => {
            if (rule.scoreSource === "COMPLIANCE") return false;
            const score = rule.scoreSource === "TOTAL"
                ? (complianceScore + performanceScore) / 2
                : performanceScore;
            return compareKpi(score, rule.comparator, rule.threshold);
        });
    }

    return {
        params: details,
        complianceScore,
        performanceScore,
        compliancePassed,
        benefitType: matched?.benefitType || (!compliancePassed ? "PUNISHMENT" : "NONE"),
        benefitLabel: matched?.label || (!compliancePassed ? "Tidak memenuhi compliance" : ""),
        benefitRuleId: matched?.id || null,
        missingTargetCount: details.filter((item) => item.target === null).length,
    };
}

function mapParams(rows: (typeof mitraProgramParams.$inferSelect)[]): KpiParamInput[] {
    return rows.map((param) => ({
        id: param.id,
        key: param.key,
        label: param.label,
        unit: param.unit,
        category: param.kpiCategory,
        aggregation: param.aggregation,
        weight: Number(param.weight) || 0,
        cap: param.achievementCap === null ? null : Number(param.achievementCap),
        polarity: param.polarity,
    }));
}

function mapRules(rows: (typeof mitraProgramRewardRules.$inferSelect)[]): KpiRuleInput[] {
    return rows
        .filter((rule) => rule.comparator && rule.thresholdValue !== null)
        .map((rule) => ({
            id: rule.id,
            scoreSource: rule.scoreSource || "PERFORMANCE",
            comparator: rule.comparator!,
            threshold: Number(rule.thresholdValue),
            benefitType: rule.benefitType || "NONE",
            label: rule.rewardLabel,
            sortOrder: rule.sortOrder,
        }));
}

interface KpiRuntimeData {
    program: typeof mitraPrograms.$inferSelect;
    params: KpiParamInput[];
    participants: { participantKey: string; id: string; name: string; tap: string }[];
    outlets: { id: string; code: string; name: string; tap: string; salesforceId: string }[];
    targets: (typeof mitraKpiTargets.$inferSelect)[];
    scores: { salesforceId: string; outletId: string; paramId: string; rawValue: string; achievementDate: string }[];
    rules: KpiRuleInput[];
}

async function loadKpiRuntimeData(programId: string): Promise<KpiRuntimeData | null> {
    const [program] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, programId)).limit(1);
    if (!program || program.mechanismType !== "KPI" || program.targetType !== "SALESFORCE") return null;

    const [paramRows, participantRows, outletRows, targets, scores, ruleRows] = await Promise.all([
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, programId)).orderBy(asc(mitraProgramParams.sortOrder)),
        db.select({
            participantKey: mitraProgramParticipants.participantKey,
            id: mitraSalesforces.id,
            name: mitraSalesforces.name,
            tap: mitraSalesforces.tap,
        }).from(mitraProgramParticipants)
            .innerJoin(mitraSalesforces, eq(mitraProgramParticipants.salesforceId, mitraSalesforces.id))
            .where(eq(mitraProgramParticipants.programId, programId))
            .orderBy(asc(mitraSalesforces.name)),
        db.select({
            id: mitraOutlets.id,
            code: mitraOutlets.outletCode,
            name: mitraOutlets.name,
            tap: mitraOutlets.tap,
            salesforceId: mitraOutlets.salesforceId,
        }).from(mitraOutlets),
        db.select().from(mitraKpiTargets).where(eq(mitraKpiTargets.programId, programId)),
        // Agregasi harian dipadatkan di MySQL menjadi satu baris per outlet+parameter.
        // Dengan begitu program 900 ribu baris tidak ditarik seluruhnya ke proses Next.js.
        db.select({
            salesforceId: mitraKpiOutletScores.salesforceId,
            outletId: mitraKpiOutletScores.outletId,
            paramId: mitraKpiOutletScores.paramId,
            rawValue: sql<string>`case
                when ${mitraProgramParams.aggregation} = 'AVG' then avg(${mitraKpiOutletScores.rawValue})
                when ${mitraProgramParams.aggregation} = 'LAST' then substring_index(group_concat(${mitraKpiOutletScores.rawValue} order by ${mitraKpiOutletScores.achievementDate} desc), ',', 1)
                else sum(${mitraKpiOutletScores.rawValue}) end`,
            achievementDate: sql<string>`max(${mitraKpiOutletScores.achievementDate})`,
        }).from(mitraKpiOutletScores)
            .innerJoin(mitraProgramParams, eq(mitraKpiOutletScores.paramId, mitraProgramParams.id))
            .where(eq(mitraKpiOutletScores.programId, programId))
            .groupBy(
                mitraKpiOutletScores.salesforceId,
                mitraKpiOutletScores.outletId,
                mitraKpiOutletScores.paramId,
                mitraProgramParams.aggregation
            ),
        db.select().from(mitraProgramRewardRules).where(eq(mitraProgramRewardRules.programId, programId)).orderBy(asc(mitraProgramRewardRules.sortOrder)),
    ]);

    return {
        program,
        params: mapParams(paramRows),
        participants: participantRows.map((row) => ({ ...row, tap: row.tap || "" })),
        outlets: outletRows.filter((row): row is typeof row & { salesforceId: string } => Boolean(row.salesforceId)),
        targets,
        scores,
        rules: mapRules(ruleRows),
    };
}

function evaluateRuntimeParticipant(data: KpiRuntimeData, participant: KpiRuntimeData["participants"][number]) {
    const participantTargets = new Map(
        data.targets
            .filter((target) => target.salesforceId === participant.id)
            .map((target) => [target.paramId, Number(target.targetValue)])
    );
    const outletIds = data.outlets.filter((outlet) => outlet.salesforceId === participant.id).map((outlet) => outlet.id);
    const actuals = new Map<string, number>();
    for (const param of data.params) {
        const rows = data.scores
            .filter((score) => score.salesforceId === participant.id && score.paramId === param.id)
            .map((score) => ({ outletId: score.outletId, rawValue: Number(score.rawValue), achievementDate: score.achievementDate }));
        actuals.set(param.id, aggregateKpiActual(rows, outletIds, param.aggregation));
    }
    return evaluateKpi(
        data.params,
        participantTargets,
        actuals,
        data.rules,
        data.program.kpiComplianceMinScore === null ? null : Number(data.program.kpiComplianceMinScore)
    );
}

export async function recomputeKpiResults(programId: string) {
    const data = await loadKpiRuntimeData(programId);
    if (!data) throw new Error("Program KPI Salesforce tidak ditemukan");

    const computedAt = new Date();
    const rows = data.participants.map((participant) => {
        const result = evaluateRuntimeParticipant(data, participant);
        return {
            id: uuid(),
            programId,
            participantKey: participant.participantKey,
            salesforceId: participant.id,
            tap: participant.tap,
            complianceScore: toDecimalString(result.complianceScore),
            performanceScore: toDecimalString(result.performanceScore),
            compliancePassed: result.compliancePassed,
            benefitType: result.benefitType,
            benefitLabel: result.benefitLabel,
            benefitRuleId: result.benefitRuleId,
            computedAt,
        } satisfies typeof mitraKpiResults.$inferInsert;
    });

    await db.transaction(async (tx) => {
        await tx.delete(mitraKpiResults).where(eq(mitraKpiResults.programId, programId));
        if (rows.length > 0) await tx.insert(mitraKpiResults).values(rows);
    });

    return { computed: rows.length, missingTargets: data.participants.reduce((sum, participant) => sum + evaluateRuntimeParticipant(data, participant).missingTargetCount, 0) };
}

export interface KpiPublicFilters {
    tap?: string;
    sf?: string;
    param?: string;
    q?: string;
    page?: number;
}

export async function getPublicKpiDetail(programId: string, filters: KpiPublicFilters = {}) {
    const data = await loadKpiRuntimeData(programId);
    if (!data) return null;

    const cachedRows = await db.select().from(mitraKpiResults).where(eq(mitraKpiResults.programId, programId));
    const cachedByKey = new Map(cachedRows.map((row) => [row.participantKey, row]));
    const participants = data.participants.map((participant) => {
        const evaluation = evaluateRuntimeParticipant(data, participant);
        const cached = cachedByKey.get(participant.participantKey);
        const benefitType = cached?.benefitType || evaluation.benefitType;
        const hideLabel = data.program.kpiHidePunishment && benefitType === "PUNISHMENT";
        return {
            participantKey: participant.participantKey,
            id: participant.id,
            name: participant.name,
            tap: participant.tap || "(Tanpa TAP)",
            complianceScore: Number(cached?.complianceScore ?? evaluation.complianceScore),
            performanceScore: Number(cached?.performanceScore ?? evaluation.performanceScore),
            compliancePassed: cached?.compliancePassed ?? evaluation.compliancePassed,
            benefitType,
            benefitLabel: hideLabel ? "Disembunyikan" : (cached?.benefitLabel ?? evaluation.benefitLabel),
            params: evaluation.params,
            missingTargetCount: evaluation.missingTargetCount,
        };
    });

    const tapMap = new Map<string, typeof participants>();
    for (const participant of participants) {
        const bucket = tapMap.get(participant.tap) || [];
        bucket.push(participant);
        tapMap.set(participant.tap, bucket);
    }
    const taps = Array.from(tapMap, ([tap, rows]) => ({
        tap,
        salesforceCount: rows.length,
        complianceScore: rows.length ? rows.reduce((sum, row) => sum + row.complianceScore, 0) / rows.length : 0,
        performanceScore: rows.length ? rows.reduce((sum, row) => sum + row.performanceScore, 0) / rows.length : 0,
        rewardCount: rows.filter((row) => row.benefitType === "REWARD").length,
        punishmentCount: rows.filter((row) => row.benefitType === "PUNISHMENT").length,
        participants: rows.map((row) => ({
            participantKey: row.participantKey,
            id: row.id,
            name: row.name,
            tap: row.tap,
            complianceScore: row.complianceScore,
            performanceScore: row.performanceScore,
            compliancePassed: row.compliancePassed,
            benefitType: row.benefitType,
            benefitLabel: row.benefitLabel,
            missingTargetCount: row.missingTargetCount,
        })),
    })).sort((a, b) => a.tap.localeCompare(b.tap));

    const query = (filters.q || "").trim().toLowerCase();
    const outletById = new Map(data.outlets.map((outlet) => [outlet.id, outlet]));
    const sfById = new Map(data.participants.map((participant) => [participant.id, participant]));
    const paramById = new Map(data.params.map((param) => [param.id, param]));
    const outletGroups = new Map<string, { outletId: string; salesforceId: string; paramId: string; rows: KpiRawValue[] }>();
    for (const score of data.scores) {
        const outlet = outletById.get(score.outletId);
        const sf = sfById.get(score.salesforceId);
        const param = paramById.get(score.paramId);
        if (!outlet || !sf || !param) continue;
        const tap = sf.tap || "(Tanpa TAP)";
        if (filters.tap && tap !== filters.tap) continue;
        if (filters.sf && sf.id !== filters.sf) continue;
        if (filters.param && param.id !== filters.param && param.key !== filters.param) continue;
        if (query && !`${outlet.name} ${outlet.code}`.toLowerCase().includes(query)) continue;
        const key = `${score.outletId}|${score.paramId}`;
        const group = outletGroups.get(key) || { outletId: score.outletId, salesforceId: score.salesforceId, paramId: score.paramId, rows: [] };
        group.rows.push({ outletId: score.outletId, rawValue: Number(score.rawValue), achievementDate: score.achievementDate });
        outletGroups.set(key, group);
    }
    const allOutletRows = Array.from(outletGroups.values()).map((group) => {
        const outlet = outletById.get(group.outletId)!;
        const sf = sfById.get(group.salesforceId)!;
        const param = paramById.get(group.paramId)!;
        return {
            outletId: outlet.id,
            outletCode: outlet.code,
            outletName: outlet.name,
            tap: sf.tap || "(Tanpa TAP)",
            salesforceId: sf.id,
            salesforceName: sf.name,
            paramId: param.id,
            paramKey: param.key,
            paramLabel: param.label,
            unit: param.unit,
            actual: aggregateKpiActual(group.rows, [outlet.id], param.aggregation),
        };
    }).sort((a, b) => a.outletName.localeCompare(b.outletName) || a.paramLabel.localeCompare(b.paramLabel));
    const page = Math.max(1, Math.floor(filters.page || 1));
    const pageSize = 100;

    return {
        summary: {
            salesforceCount: participants.length,
            averageCompliance: participants.length ? participants.reduce((sum, row) => sum + row.complianceScore, 0) / participants.length : 0,
            averagePerformance: participants.length ? participants.reduce((sum, row) => sum + row.performanceScore, 0) / participants.length : 0,
            rewardCount: participants.filter((row) => row.benefitType === "REWARD").length,
            punishmentCount: participants.filter((row) => row.benefitType === "PUNISHMENT").length,
            missingTargetCount: participants.reduce((sum, row) => sum + row.missingTargetCount, 0),
        },
        complianceMinScore: data.program.kpiComplianceMinScore === null ? null : Number(data.program.kpiComplianceMinScore),
        hidePunishment: data.program.kpiHidePunishment,
        taps,
        participants,
        filters: {
            taps: Array.from(new Set(participants.map((row) => row.tap))).sort(),
            salesforces: participants.map((row) => ({ id: row.id, name: row.name, tap: row.tap })),
            params: data.params.filter((param) => param.category !== "NONE").map((param) => ({ id: param.id, key: param.key, label: param.label })),
        },
        outletRows: allOutletRows.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, total: allOutletRows.length, totalPages: Math.max(1, Math.ceil(allOutletRows.length / pageSize)) },
    };
}

export async function getAdminKpiResults(programId: string) {
    const rows = await db.select({
        participantKey: mitraKpiResults.participantKey,
        salesforceId: mitraKpiResults.salesforceId,
        salesforceName: mitraSalesforces.name,
        tap: mitraKpiResults.tap,
        complianceScore: mitraKpiResults.complianceScore,
        performanceScore: mitraKpiResults.performanceScore,
        compliancePassed: mitraKpiResults.compliancePassed,
        benefitType: mitraKpiResults.benefitType,
        benefitLabel: mitraKpiResults.benefitLabel,
        computedAt: mitraKpiResults.computedAt,
    }).from(mitraKpiResults)
        .innerJoin(mitraSalesforces, eq(mitraKpiResults.salesforceId, mitraSalesforces.id))
        .where(eq(mitraKpiResults.programId, programId))
        .orderBy(asc(mitraKpiResults.tap), asc(mitraSalesforces.name));
    return rows;
}

export async function deleteKpiData(programId: string) {
    await db.transaction(async (tx) => {
        await tx.delete(mitraKpiOutletScores).where(eq(mitraKpiOutletScores.programId, programId));
        await tx.delete(mitraKpiResults).where(eq(mitraKpiResults.programId, programId));
    });
}
