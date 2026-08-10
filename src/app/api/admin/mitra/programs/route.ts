import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraProgramParams, mitraProgramRewardRules, mitraPrograms } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { computeMitraProgramRewards, recomputeMitraProgramLeaderboard } from "@/lib/mitra-data";
import { getClientIp, slugify } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const programs = await db.select().from(mitraPrograms).orderBy(desc(mitraPrograms.periodStart));
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
    const id = uuid();
    const now = new Date();
    const name = String(body.name || "").trim();

    if (!name || !body.periodStart || !body.periodEnd) {
        return NextResponse.json({ error: "Nama dan periode program wajib diisi" }, { status: 400 });
    }

    await db.insert(mitraPrograms).values({
        id,
        name,
        slug: body.slug ? slugify(String(body.slug)) : slugify(name),
        descriptionMd: body.descriptionMd || "",
        mechanismMd: body.mechanismMd || "",
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        status: body.status || "DRAFT",
        rankingMode: body.rankingMode || "POINT",
        mechanismType: body.mechanismType || "RANKING",
        tieBreaker: body.tieBreaker || null,
        isPublic: Boolean(body.isPublic),
        createdAt: now,
    });

    if (Array.isArray(body.params) && body.params.length > 0) {
        await db.insert(mitraProgramParams).values(
            body.params.map((param: Record<string, unknown>, index: number) => ({
                id: uuid(),
                programId: id,
                key: String(param.key || slugify(String(param.label || `param-${index + 1}`))).replace(/-/g, "_"),
                label: String(param.label || `Parameter ${index + 1}`),
                unit: param.unit ? String(param.unit) : null,
                weight: String(param.weight || "1"),
                aggregation: param.aggregation || "SUM",
                sortOrder: index,
            }))
        );
    }

    if (Array.isArray(body.rewardRules) && body.rewardRules.length > 0) {
        await db.insert(mitraProgramRewardRules).values(
            body.rewardRules.map((rule: Record<string, unknown>, index: number) => ({
                id: uuid(),
                programId: id,
                ruleType: rule.ruleType === "THRESHOLD" ? "THRESHOLD" : "RANK",
                rankFrom: rule.rankFrom !== undefined && rule.rankFrom !== null && rule.rankFrom !== "" ? Number(rule.rankFrom) : null,
                rankTo: rule.rankTo !== undefined && rule.rankTo !== null && rule.rankTo !== "" ? Number(rule.rankTo) : null,
                paramKey: rule.paramKey ? String(rule.paramKey) : null,
                comparator: rule.comparator ? String(rule.comparator) : null,
                thresholdValue: rule.thresholdValue !== undefined && rule.thresholdValue !== null && rule.thresholdValue !== "" ? String(rule.thresholdValue) : null,
                rewardLabel: String(rule.rewardLabel || `Reward ${index + 1}`),
                sortOrder: index,
            }))
        );
    }

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "CREATE",
        entity: "mitra_program",
        entityId: id,
        diff: { name, status: body.status, isPublic: body.isPublic },
        ip: getClientIp(request),
    });

    const [created] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id));
    return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    if (!body.programId || !["recompute", "compute_rewards"].includes(body.action)) {
        return NextResponse.json({ error: "Aksi tidak valid" }, { status: 400 });
    }

    if (body.action === "compute_rewards") {
        const rewards = await computeMitraProgramRewards(String(body.programId));
        return NextResponse.json({ rewards });
    }

    await recomputeMitraProgramLeaderboard(String(body.programId));
    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "RECOMPUTE",
        entity: "mitra_program_leaderboard",
        entityId: String(body.programId),
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
