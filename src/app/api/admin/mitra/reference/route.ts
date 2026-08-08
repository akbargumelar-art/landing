import { NextResponse } from "next/server";
import { asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import {
    mitraMetricDefs,
    mitraOutletMetrics,
    mitraProgramParams,
    mitraProgramScores,
    mitraPrograms,
} from "@/db/schema";
import { requireRole } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Daftar key yang sah untuk berkas import, beserta jumlah pemakaiannya.
 *
 * Jumlah baris ikut dihitung karena itu yang membedakan key yang benar-benar terpakai
 * dari key sisa percobaan -- tanpa angka itu, daftar panjang key tidak memberi tahu mana
 * yang aman dipakai dan mana yang sebaiknya dirapikan.
 */
export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const metrics = await db
        .select({
            id: mitraMetricDefs.id,
            key: mitraMetricDefs.key,
            label: mitraMetricDefs.label,
            unit: mitraMetricDefs.unit,
            aggregation: mitraMetricDefs.aggregation,
            isPublic: mitraMetricDefs.isPublic,
            jumlahBaris: count(mitraOutletMetrics.id),
        })
        .from(mitraMetricDefs)
        .leftJoin(mitraOutletMetrics, eq(mitraOutletMetrics.metricDefId, mitraMetricDefs.id))
        .groupBy(mitraMetricDefs.id)
        .orderBy(asc(mitraMetricDefs.key));

    const programs = await db
        .select({
            id: mitraPrograms.id,
            name: mitraPrograms.name,
            slug: mitraPrograms.slug,
            status: mitraPrograms.status,
            isPublic: mitraPrograms.isPublic,
        })
        .from(mitraPrograms)
        .orderBy(asc(mitraPrograms.name));

    const params = await db
        .select({
            id: mitraProgramParams.id,
            programId: mitraProgramParams.programId,
            key: mitraProgramParams.key,
            label: mitraProgramParams.label,
            unit: mitraProgramParams.unit,
            weight: mitraProgramParams.weight,
            aggregation: mitraProgramParams.aggregation,
            jumlahBaris: count(mitraProgramScores.id),
        })
        .from(mitraProgramParams)
        .leftJoin(mitraProgramScores, eq(mitraProgramScores.paramId, mitraProgramParams.id))
        .groupBy(mitraProgramParams.id)
        .orderBy(asc(mitraProgramParams.sortOrder), asc(mitraProgramParams.key));

    return NextResponse.json({
        metrics,
        programs: programs.map((program) => ({
            ...program,
            params: params.filter((param) => param.programId === program.id),
        })),
    });
}
