import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraProgramParams, mitraProgramRewardRules, mitraPrograms } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { recomputeKpiResults } from "@/lib/mitra-kpi";
import {
    buildRewardRuleValues,
    computeProgramRewards,
    normalizeGroupBy,
    normalizeMechanismType,
    normalizeTargetType,
    recomputeProgramLeaderboard,
    searchParticipantCandidates,
} from "@/lib/mitra-programs";
import { getClientIp, slugify } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const targetType = normalizeTargetType(url.searchParams.get("targetType"));

    // Pencarian kandidat peserta dilayani lewat route yang sama supaya halaman admin
    // cukup mengenal satu alamat untuk seluruh urusan program.
    const cariPeserta = url.searchParams.get("participantQuery");
    if (cariPeserta !== null) {
        return NextResponse.json({ candidates: await searchParticipantCandidates(targetType, cariPeserta) });
    }

    const programs = await db
        .select()
        .from(mitraPrograms)
        .where(eq(mitraPrograms.targetType, targetType))
        .orderBy(desc(mitraPrograms.periodStart));
    const params = await db.select().from(mitraProgramParams).orderBy(asc(mitraProgramParams.sortOrder));
    const rewardRules = await db.select().from(mitraProgramRewardRules).orderBy(asc(mitraProgramRewardRules.sortOrder));

    return NextResponse.json({
        programs: programs.map((program) => ({
            ...program,
            params: params.filter((param) => param.programId === program.id),
            rewardRules: rewardRules.filter((rule) => rule.programId === program.id),
        })),
    });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();

    if (!name || !body.periodStart || !body.periodEnd) {
        return NextResponse.json({ error: "Nama dan periode program wajib diisi" }, { status: 400 });
    }

    const id = uuid();
    const targetType = normalizeTargetType(body.targetType);
    const mechanismType = normalizeMechanismType(body.mechanismType);
    if (mechanismType === "KPI" && targetType !== "SALESFORCE") {
        return NextResponse.json({ error: "Mekanisme KPI hanya tersedia untuk Program Salesforce" }, { status: 400 });
    }

    await db.insert(mitraPrograms).values({
        id,
        name,
        slug: body.slug ? slugify(String(body.slug)) : slugify(name),
        targetType,
        mechanismType,
        groupBy: mechanismType === "KPI" ? "NONE" : normalizeGroupBy(body.groupBy),
        thumbnailUrl: body.thumbnailUrl || null,
        descriptionMd: body.descriptionMd || "",
        mechanismMd: body.mechanismMd || "",
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        status: body.status || "DRAFT",
        isPublic: Boolean(body.isPublic),
        kpiComplianceMinScore: mechanismType === "KPI" && body.kpiComplianceMinScore !== "" && body.kpiComplianceMinScore != null
            ? String(body.kpiComplianceMinScore) : null,
        kpiDefaultCap: mechanismType === "KPI" && body.kpiDefaultCap !== "" && body.kpiDefaultCap != null
            ? String(body.kpiDefaultCap) : null,
        kpiHidePunishment: mechanismType === "KPI" ? Boolean(body.kpiHidePunishment) : false,
        createdAt: new Date(),
    });

    if (Array.isArray(body.params) && body.params.length > 0) {
        await db.insert(mitraProgramParams).values(
            body.params.map((param: Record<string, unknown>, index: number) => ({
                id: uuid(),
                programId: id,
                key: String(param.key || slugify(String(param.label || `param-${index + 1}`))).replace(/-/g, "_"),
                label: String(param.label || `Parameter ${index + 1}`),
                unit: param.unit ? String(param.unit) : null,
                weight: String(param.weight ?? (mechanismType === "KPI" ? "0" : "1")),
                aggregation: param.aggregation || "SUM",
                isScored: param.isScored !== false,
                kpiCategory: mechanismType === "KPI" && ["COMPLIANCE", "PERFORMANCE"].includes(String(param.kpiCategory).toUpperCase())
                    ? String(param.kpiCategory).toUpperCase() as "COMPLIANCE" | "PERFORMANCE" : "NONE",
                achievementCap: mechanismType === "KPI"
                    ? (param.achievementCap !== "" && param.achievementCap != null
                        ? String(param.achievementCap)
                        : body.kpiDefaultCap !== "" && body.kpiDefaultCap != null ? String(body.kpiDefaultCap) : null)
                    : null,
                polarity: mechanismType === "KPI" && String(param.polarity).toUpperCase().startsWith("LOWER")
                    ? "LOWER_BETTER" : "HIGHER_BETTER",
                sortOrder: index,
            }))
        );
    }

    if (Array.isArray(body.rewardRules) && body.rewardRules.length > 0) {
        await db.insert(mitraProgramRewardRules).values(buildRewardRuleValues(id, mechanismType, body.rewardRules));
    }

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "CREATE",
        entity: "mitra_program",
        entityId: id,
        diff: { name, targetType, mechanismType, status: body.status },
        ip: getClientIp(request),
    });

    const [created] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id));
    return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const programId = String(body.programId || "");
    if (!programId || !["recompute", "compute_rewards"].includes(String(body.action))) {
        return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
    }

    if (body.action === "compute_rewards") {
        return NextResponse.json({ rewards: await computeProgramRewards(programId) });
    }

    const [program] = await db.select({ mechanismType: mitraPrograms.mechanismType })
        .from(mitraPrograms).where(eq(mitraPrograms.id, programId)).limit(1);
    if (!program) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });
    const result = program.mechanismType === "KPI"
        ? await recomputeKpiResults(programId)
        : (await recomputeProgramLeaderboard(programId), { success: true });
    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "RECOMPUTE",
        entity: program.mechanismType === "KPI" ? "mitra_kpi_results" : "mitra_program_leaderboard",
        entityId: programId,
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, ...result });
}
