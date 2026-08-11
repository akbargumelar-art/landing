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
import { getAdminKpiResults } from "@/lib/mitra-kpi";
import {
    buildRewardRuleValues,
    groupValueOf,
    listProgramParticipants,
    normalizeGroupBy,
    normalizeMechanismType,
    participantColumns,
    resolveParticipantCodes,
    type ProgramGroupBy,
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
    const [programParams, participants, rewardRules, winnerRows, kpiResults] = await Promise.all([
        db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, id)).orderBy(asc(mitraProgramParams.sortOrder)),
        listProgramParticipants(id, targetType),
        db.select().from(mitraProgramRewardRules).where(eq(mitraProgramRewardRules.programId, id)).orderBy(asc(mitraProgramRewardRules.sortOrder)),
        db.select().from(mitraProgramWinners).where(eq(mitraProgramWinners.programId, id)).orderBy(asc(mitraProgramWinners.rank)),
        program.mechanismType === "KPI" ? getAdminKpiResults(id) : Promise.resolve([]),
    ]);

    // Pemenang disimpan berbasis participantKey; nama dan kodenya diambil dari daftar
    // peserta supaya tampilan admin tidak perlu menebak dari tabel mana identitasnya.
    const pesertaByKey = new Map(participants.map((item) => [item.participantKey, item]));
    const winners = winnerRows.map((row) => ({
        id: row.id,
        participantKey: row.participantKey,
        code: pesertaByKey.get(row.participantKey)?.code || "",
        name: pesertaByKey.get(row.participantKey)?.name || "",
        groupKey: row.groupKey,
        rank: row.rank,
        prizeLabel: row.prizeLabel,
        isPublished: row.isPublished,
    }));

    return NextResponse.json({ program, params: programParams, participants, rewardRules, winners, kpiResults });
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
        if (existing.mechanismType === "KPI") {
            return NextResponse.json({ error: "Program KPI tidak memiliki pemenang atau peringkat" }, { status: 400 });
        }
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
        if (existing.groupBy === "NONE" && existing.mechanismType === "RACING"
            && new Set(diminta.map((winner) => winner.rank)).size !== diminta.length) {
            return NextResponse.json({ error: "Peringkat pemenang tidak boleh duplikat pada program racing" }, { status: 400 });
        }

        const resolved = await resolveParticipantCodes(targetType, diminta.map((winner) => winner.code));
        const tidakDikenal = diminta.map((winner) => winner.code).filter((code) => !resolved.has(code));
        if (tidakDikenal.length > 0) {
            return NextResponse.json({ error: `Peserta tidak ditemukan: ${tidakDikenal.join(", ")}` }, { status: 400 });
        }

        // Wilayah pemenang diambil dari data pesertanya, bukan diminta dari form: sumber
        // yang sama dipakai saat menghitung peringkat, jadi keduanya tidak bisa berselisih.
        const groupBy = existing.groupBy as ProgramGroupBy;
        const pesertaProgram = await listProgramParticipants(id, targetType);
        const groupByCode = new Map(pesertaProgram.map((item) => [item.code, groupValueOf(item, groupBy)]));

        await db.transaction(async (tx) => {
            await tx.delete(mitraProgramWinners).where(eq(mitraProgramWinners.programId, id));
            await tx.insert(mitraProgramWinners).values(diminta.map((winner) => ({
                id: uuid(),
                programId: id,
                ...participantColumns(targetType, resolved.get(winner.code)!.id),
                groupKey: groupByCode.get(winner.code) || "",
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

    const mechanismType = body.mechanismType ? normalizeMechanismType(body.mechanismType) : existing.mechanismType;
    if (mechanismType === "KPI" && existing.targetType !== "SALESFORCE") {
        return NextResponse.json({ error: "Mekanisme KPI hanya tersedia untuk Program Salesforce" }, { status: 400 });
    }

    await db.update(mitraPrograms).set({
        name: body.name ?? existing.name,
        slug: body.slug ? slugify(String(body.slug)) : existing.slug,
        mechanismType,
        groupBy: mechanismType === "KPI" ? "NONE" : body.groupBy ? normalizeGroupBy(body.groupBy) : existing.groupBy,
        thumbnailUrl: body.thumbnailUrl === "" ? null : body.thumbnailUrl ?? existing.thumbnailUrl,
        descriptionMd: body.descriptionMd ?? existing.descriptionMd,
        mechanismMd: body.mechanismMd ?? existing.mechanismMd,
        periodStart: body.periodStart ? new Date(body.periodStart) : existing.periodStart,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : existing.periodEnd,
        status: body.status ?? existing.status,
        isPublic: body.isPublic ?? existing.isPublic,
        kpiComplianceMinScore: mechanismType === "KPI"
            ? (body.kpiComplianceMinScore === "" ? null : body.kpiComplianceMinScore ?? existing.kpiComplianceMinScore)
            : null,
        kpiDefaultCap: mechanismType === "KPI"
            ? (body.kpiDefaultCap === "" ? null : body.kpiDefaultCap ?? existing.kpiDefaultCap)
            : null,
        kpiHidePunishment: mechanismType === "KPI"
            ? body.kpiHidePunishment ?? existing.kpiHidePunishment
            : false,
    }).where(eq(mitraPrograms.id, id));

    if (Array.isArray(body.params)) {
        /**
         * Dicocokkan berdasarkan `key`, bukan id: key adalah identitas yang juga dipakai
         * berkas unggahan, dan editor parameter di admin berbentuk teks yang tidak membawa
         * id. Mencocokkan lewat id akan membuat setiap penyimpanan mencoba menyisipkan
         * parameter baru dengan key yang sudah ada, dan ditolak unique index.
         */
        const existingParams = await db.select().from(mitraProgramParams).where(eq(mitraProgramParams.programId, id));
        const byKey = new Map(existingParams.map((param) => [param.key, param]));
        const keyDikirim = new Set<string>();

        for (const [index, param] of body.params.entries()) {
            const key = String(param.key || slugify(String(param.label || `param-${index + 1}`))).replace(/-/g, "_");
            const kpiCategory: "NONE" | "COMPLIANCE" | "PERFORMANCE" = mechanismType === "KPI" && ["COMPLIANCE", "PERFORMANCE"].includes(String(param.kpiCategory).toUpperCase())
                ? String(param.kpiCategory).toUpperCase() as "COMPLIANCE" | "PERFORMANCE" : "NONE";
            keyDikirim.add(key);
            const values = {
                key,
                label: String(param.label || `Parameter ${index + 1}`),
                unit: param.unit ? String(param.unit) : null,
                weight: String(param.weight ?? (mechanismType === "KPI" ? "0" : "1")),
                aggregation: param.aggregation || "SUM",
                isScored: param.isScored !== false,
                kpiCategory,
                achievementCap: mechanismType === "KPI" && param.achievementCap !== "" && param.achievementCap != null
                    ? String(param.achievementCap) : null,
                polarity: mechanismType === "KPI" && String(param.polarity).toUpperCase().startsWith("LOWER")
                    ? "LOWER_BETTER" as const : "HIGHER_BETTER" as const,
                sortOrder: index,
            };

            const lama = byKey.get(key);
            if (lama) {
                await db.update(mitraProgramParams).set(values).where(eq(mitraProgramParams.id, lama.id));
            } else {
                await db.insert(mitraProgramParams).values({ id: uuid(), programId: id, ...values });
            }
        }

        // Parameter yang hilang dari daftar ikut dihapus beserta seluruh nilai pencapaiannya
        // (lewat cascade). Halaman admin meminta konfirmasi lebih dulu, sehingga penghapusan
        // ini selalu merupakan pilihan sadar, bukan efek samping menyunting teks.
        const dihapus = existingParams.filter((param) => !keyDikirim.has(param.key));
        for (const param of dihapus) {
            await db.delete(mitraProgramParams).where(eq(mitraProgramParams.id, param.id));
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
