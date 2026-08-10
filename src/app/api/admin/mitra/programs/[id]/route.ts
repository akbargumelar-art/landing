import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import {
    mitraProgramParams,
    mitraProgramParticipants,
    mitraProgramRewardRules,
    mitraPrograms,
    mitraProgramWinners,
} from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import {
    buildRewardRuleValues,
    listProgramParticipants,
    participantColumns,
    resolveParticipantCodes,
    type ProgramTargetType,
} from "@/lib/mitra-programs";
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

    const targetType = program.targetType as ProgramTargetType;
    const [programParams, participants, rewardRules, winnerRows] = await Promise.all([
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, id)).orderBy(asc(mitraProgramParams.sortOrder)),
        listProgramParticipants(id, targetType),
        db.select().from(mitraProgramRewardRules).where(eq(mitraProgramRewardRules.programId, id)).orderBy(asc(mitraProgramRewardRules.sortOrder)),
        db.select().from(mitraProgramWinners).where(eq(mitraProgramWinners.programId, id)).orderBy(asc(mitraProgramWinners.rank)),
    ]);

    // Pemenang disimpan berbasis participantKey; nama dan kodenya diambil dari daftar
    // peserta supaya tampilan admin tidak perlu menebak dari tabel mana identitasnya.
    const pesertaByKey = new Map(participants.map((item) => [item.participantKey, item]));
    const winners = winnerRows.map((row) => ({
        id: row.id,
        participantKey: row.participantKey,
        code: pesertaByKey.get(row.participantKey)?.code || "",
        name: pesertaByKey.get(row.participantKey)?.name || "",
        rank: row.rank,
        prizeLabel: row.prizeLabel,
        isPublished: row.isPublished,
    }));

    return NextResponse.json({ program, params: programParams, participants, rewardRules, winners });
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

    const targetType = existing.targetType as ProgramTargetType;

    if (body.action === "configure_participants") {
        const codes = Array.isArray(body.codes)
            ? Array.from(new Set((body.codes as unknown[]).map((value) => String(value).trim()).filter(Boolean)))
            : [];
        const resolved = await resolveParticipantCodes(targetType, codes);
        const tidakDikenal = codes.filter((code) => !resolved.has(code));
        if (tidakDikenal.length > 0) {
            return NextResponse.json({ error: `Peserta tidak ditemukan: ${tidakDikenal.join(", ")}` }, { status: 400 });
        }

        await db.transaction(async (tx) => {
            await tx.delete(mitraProgramParticipants).where(eq(mitraProgramParticipants.programId, id));
            if (resolved.size === 0) return;
            await tx.insert(mitraProgramParticipants).values(
                Array.from(resolved.values()).map((peserta) => ({
                    programId: id,
                    ...participantColumns(targetType, peserta.id),
                    joinedAt: new Date(),
                }))
            );
        });

        await writeAdminAuditLog({
            userId: auth.session?.userId,
            action: "UPDATE_PARTICIPANTS",
            entity: "mitra_program",
            entityId: id,
            diff: { participantCount: resolved.size },
            ip: getClientIp(request),
        });
        return NextResponse.json({ success: true, participantCount: resolved.size });
    }

    if (body.action === "publish_winners") {
        const diminta = Array.isArray(body.winners)
            ? (body.winners as unknown[]).map((value) => {
                const row = value as Record<string, unknown>;
                return {
                    code: String(row.code || "").trim(),
                    rank: Number(row.rank),
                    prizeLabel: row.prizeLabel ? String(row.prizeLabel).trim() : null,
                };
            }).filter((winner) => winner.code && Number.isInteger(winner.rank) && winner.rank > 0)
            : [];

        if (diminta.length === 0) {
            return NextResponse.json({ error: "Minimal satu pemenang wajib diisi" }, { status: 400 });
        }
        if (new Set(diminta.map((winner) => winner.code)).size !== diminta.length) {
            return NextResponse.json({ error: "Satu peserta tidak boleh muncul lebih dari sekali" }, { status: 400 });
        }
        /**
         * Peringkat kembar ditolak pada program RACING karena di sana peringkat adalah
         * posisi yang harus unik. Pada program REWARD peringkat hanya nomor urut daftar,
         * sehingga banyak penerima boleh berbagi nomor yang sama.
         */
        if (existing.mechanismType === "RACING" && new Set(diminta.map((winner) => winner.rank)).size !== diminta.length) {
            return NextResponse.json({ error: "Peringkat pemenang tidak boleh duplikat pada program racing" }, { status: 400 });
        }

        const resolved = await resolveParticipantCodes(targetType, diminta.map((winner) => winner.code));
        const tidakDikenal = diminta.map((winner) => winner.code).filter((code) => !resolved.has(code));
        if (tidakDikenal.length > 0) {
            return NextResponse.json({ error: `Peserta tidak ditemukan: ${tidakDikenal.join(", ")}` }, { status: 400 });
        }

        await db.transaction(async (tx) => {
            await tx.delete(mitraProgramWinners).where(eq(mitraProgramWinners.programId, id));
            await tx.insert(mitraProgramWinners).values(diminta.map((winner) => ({
                id: uuid(),
                programId: id,
                ...participantColumns(targetType, resolved.get(winner.code)!.id),
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
            diff: { winnerCount: diminta.length },
            ip: getClientIp(request),
        });
        return NextResponse.json({ success: true, winnerCount: diminta.length });
    }

    const mechanismType = body.mechanismType
        ? (String(body.mechanismType).toUpperCase() === "REWARD" ? "REWARD" as const : "RACING" as const)
        : existing.mechanismType;

    await db.update(mitraPrograms).set({
        name: body.name ?? existing.name,
        slug: body.slug ? slugify(String(body.slug)) : existing.slug,
        mechanismType,
        descriptionMd: body.descriptionMd ?? existing.descriptionMd,
        mechanismMd: body.mechanismMd ?? existing.mechanismMd,
        periodStart: body.periodStart ? new Date(body.periodStart) : existing.periodStart,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : existing.periodEnd,
        status: body.status ?? existing.status,
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
                await db.update(mitraProgramParams).set(values).where(eq(mitraProgramParams.id, paramId));
            } else {
                await db.insert(mitraProgramParams).values({ id: uuid(), programId: id, ...values });
            }
        }
    }

    if (Array.isArray(body.rewardRules)) {
        // Aturan selalu diganti seluruhnya: aturan yang dihapus di form harus benar-benar
        // hilang, bukan tertinggal dan ikut dipakai saat menghitung hadiah.
        await db.transaction(async (tx) => {
            await tx.delete(mitraProgramRewardRules).where(eq(mitraProgramRewardRules.programId, id));
            if (body.rewardRules.length === 0) return;
            await tx.insert(mitraProgramRewardRules).values(buildRewardRuleValues(id, mechanismType, body.rewardRules));
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

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const [existing] = await db.select().from(mitraPrograms).where(eq(mitraPrograms.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Program tidak ditemukan" }, { status: 404 });

    // Parameter, peserta, skor, papan peringkat, pemenang, dan aturan hadiah ikut terhapus
    // lewat ON DELETE CASCADE di skema.
    await db.delete(mitraPrograms).where(eq(mitraPrograms.id, id));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "DELETE",
        entity: "mitra_program",
        entityId: id,
        diff: { name: existing.name, slug: existing.slug },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
