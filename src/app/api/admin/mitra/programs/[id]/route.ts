import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import {
    mitraOutlets,
    mitraProgramParams,
    mitraProgramParticipants,
    mitraProgramRewardRules,
    mitraPrograms,
    mitraProgramWinners,
} from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp, slugify } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const [program] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id)).limit(1);
    if (!program) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });

    const [programParams, participants, winners, rewardRules] = await Promise.all([
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, id)).orderBy(asc(mitraProgramParams.sortOrder)),
        db
            .select({ outletId: mitraOutlets.id, outletCode: mitraOutlets.outletCode, outletName: mitraOutlets.name })
            .from(mitraProgramParticipants)
            .innerJoin(mitraOutlets, eq(mitraProgramParticipants.outletId, mitraOutlets.id))
            .where(eq(mitraProgramParticipants.programId, id))
            .orderBy(asc(mitraOutlets.name)),
        db
            .select({ id: mitraProgramWinners.id, outletId: mitraOutlets.id, outletCode: mitraOutlets.outletCode, outletName: mitraOutlets.name, rank: mitraProgramWinners.rank, prizeLabel: mitraProgramWinners.prizeLabel, isPublished: mitraProgramWinners.isPublished })
            .from(mitraProgramWinners)
            .innerJoin(mitraOutlets, eq(mitraProgramWinners.outletId, mitraOutlets.id))
            .where(eq(mitraProgramWinners.programId, id))
            .orderBy(asc(mitraProgramWinners.rank)),
        db.select().from(mitraProgramRewardRules).where(eq(mitraProgramRewardRules.programId, id)).orderBy(asc(mitraProgramRewardRules.sortOrder)),
    ]);

    return NextResponse.json({ program, params: programParams, participants, winners, rewardRules });
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const [existing] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id)).limit(1);

    if (!existing) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });

    if (body.action === "configure_participants") {
        const outletCodes = Array.isArray(body.outletCodes)
            ? Array.from(new Set((body.outletCodes as unknown[]).map((value) => String(value).trim()).filter(Boolean)))
            : [];
        const outlets = outletCodes.length > 0
            ? await db.select({ id: mitraOutlets.id, outletCode: mitraOutlets.outletCode }).from(mitraOutlets).where(inArray(mitraOutlets.outletCode, outletCodes))
            : [];
        const foundCodes = new Set(outlets.map((outlet) => outlet.outletCode));
        const unknownCodes = outletCodes.filter((code) => !foundCodes.has(code));
        if (unknownCodes.length > 0) {
            return NextResponse.json({ error: `Kode outlet tidak ditemukan: ${unknownCodes.join(", ")}` }, { status: 400 });
        }

        await db.transaction(async (tx) => {
            await tx.delete(mitraProgramParticipants).where(eq(mitraProgramParticipants.programId, id));
            if (outlets.length > 0) {
                await tx.insert(mitraProgramParticipants).values(outlets.map((outlet) => ({
                    programId: id,
                    outletId: outlet.id,
                    joinedAt: new Date(),
                })));
            }
        });

        await writeAdminAuditLog({
            userId: auth.session?.userId,
            action: "UPDATE_PARTICIPANTS",
            entity: "mitra_program",
            entityId: id,
            diff: { participantCount: outlets.length },
            ip: getClientIp(request),
        });
        return NextResponse.json({ success: true, participantCount: outlets.length });
    }

    if (body.action === "publish_winners") {
        const requestedWinners = Array.isArray(body.winners)
            ? (body.winners as unknown[]).map((value) => {
                const row = value as Record<string, unknown>;
                return {
                    outletCode: String(row.outletCode || "").trim(),
                    rank: Number(row.rank),
                    prizeLabel: row.prizeLabel ? String(row.prizeLabel).trim() : null,
                };
            }).filter((winner) => winner.outletCode && Number.isInteger(winner.rank) && winner.rank > 0)
            : [];

        if (requestedWinners.length === 0) {
            return NextResponse.json({ error: "Minimal satu pemenang wajib diisi" }, { status: 400 });
        }
        if (new Set(requestedWinners.map((winner) => winner.outletCode)).size !== requestedWinners.length || new Set(requestedWinners.map((winner) => winner.rank)).size !== requestedWinners.length) {
            return NextResponse.json({ error: "Kode outlet dan peringkat pemenang tidak boleh duplikat" }, { status: 400 });
        }

        const winnerCodes = requestedWinners.map((winner) => winner.outletCode);
        const outlets = await db.select({ id: mitraOutlets.id, outletCode: mitraOutlets.outletCode }).from(mitraOutlets).where(inArray(mitraOutlets.outletCode, winnerCodes));
        const outletByCode = new Map(outlets.map((outlet) => [outlet.outletCode, outlet]));
        const unknownCodes = winnerCodes.filter((code) => !outletByCode.has(code));
        if (unknownCodes.length > 0) {
            return NextResponse.json({ error: `Kode outlet tidak ditemukan: ${unknownCodes.join(", ")}` }, { status: 400 });
        }

        await db.transaction(async (tx) => {
            await tx.delete(mitraProgramWinners).where(eq(mitraProgramWinners.programId, id));
            await tx.insert(mitraProgramWinners).values(requestedWinners.map((winner) => ({
                id: uuid(),
                programId: id,
                outletId: outletByCode.get(winner.outletCode)!.id,
                rank: winner.rank,
                prizeLabel: winner.prizeLabel,
                isPublished: true,
            })));
            await tx.update(mitraPrograms).set({ status: "PUBLISHED", isPublic: true }).where(eq(mitraPrograms.id, id));
        });

        await writeAdminAuditLog({
            userId: auth.session?.userId,
            action: "PUBLISH_WINNERS",
            entity: "mitra_program",
            entityId: id,
            diff: { winnerCount: requestedWinners.length },
            ip: getClientIp(request),
        });
        return NextResponse.json({ success: true, winnerCount: requestedWinners.length });
    }

    await db.update(mitraPrograms).set({
        name: body.name ?? existing.name,
        slug: body.slug ? slugify(String(body.slug)) : existing.slug,
        descriptionMd: body.descriptionMd ?? existing.descriptionMd,
        mechanismMd: body.mechanismMd ?? existing.mechanismMd,
        periodStart: body.periodStart ? new Date(body.periodStart) : existing.periodStart,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : existing.periodEnd,
        status: body.status ?? existing.status,
        rankingMode: body.rankingMode ?? existing.rankingMode,
        mechanismType: body.mechanismType ?? existing.mechanismType,
        tieBreaker: body.tieBreaker === "" ? null : body.tieBreaker ?? existing.tieBreaker,
        isPublic: body.isPublic ?? existing.isPublic,
    }).where(eq(mitraPrograms.id, id));

    if (Array.isArray(body.params)) {
        for (const [index, param] of body.params.entries()) {
            const paramId = String(param.id || "");
            const values = {
                key: String(param.key || slugify(String(param.label || `param-${index + 1}`))).replace(/-/g, "_"),
                label: String(param.label || `Parameter ${index + 1}`),
                unit: param.unit ? String(param.unit) : null,
                weight: String(param.weight || "1"),
                aggregation: param.aggregation || "SUM",
                sortOrder: index,
            };

            if (paramId) {
                await db
                    .update(mitraProgramParams)
                    .set(values)
                    .where(eq(mitraProgramParams.id, paramId));
            } else {
                await db.insert(mitraProgramParams).values({
                    id: uuid(),
                    programId: id,
                    ...values,
                });
            }
        }
    }

    if (Array.isArray(body.rewardRules)) {
        // Beda dari params: aturan reward selalu diganti seluruhnya, supaya rule yang
        // dihapus di form tidak tertinggal jadi rule "hantu" yang masih dipakai saat
        // menghitung reward.
        await db.transaction(async (tx) => {
            await tx.delete(mitraProgramRewardRules).where(eq(mitraProgramRewardRules.programId, id));
            if (body.rewardRules.length === 0) return;
            await tx.insert(mitraProgramRewardRules).values(
                (body.rewardRules as Record<string, unknown>[]).map((rule, index) => ({
                    id: uuid(),
                    programId: id,
                    ruleType: rule.ruleType === "THRESHOLD" ? "THRESHOLD" as const : "RANK" as const,
                    rankFrom: rule.rankFrom !== undefined && rule.rankFrom !== null && rule.rankFrom !== "" ? Number(rule.rankFrom) : null,
                    rankTo: rule.rankTo !== undefined && rule.rankTo !== null && rule.rankTo !== "" ? Number(rule.rankTo) : null,
                    paramKey: rule.paramKey ? String(rule.paramKey) : null,
                    comparator: rule.comparator ? String(rule.comparator) as ">=" | ">" | "<=" | "<" | "=" : null,
                    thresholdValue: rule.thresholdValue !== undefined && rule.thresholdValue !== null && rule.thresholdValue !== "" ? String(rule.thresholdValue) : null,
                    rewardLabel: String(rule.rewardLabel || `Reward ${index + 1}`),
                    sortOrder: index,
                }))
            );
        });
    }

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "UPDATE",
        entity: "mitra_program",
        entityId: id,
        diff: { name: body.name, status: body.status, isPublic: body.isPublic },
        ip: getClientIp(request),
    });

    const [updated] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id));
    return NextResponse.json(updated);
}
