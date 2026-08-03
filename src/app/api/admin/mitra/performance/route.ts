import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraMetricDefs, mitraOutletMetrics, mitraOutlets } from "@/db/schema";
import { getLeaderTerritoryIds, requireMitraAccess, writeMitraAuditLog } from "@/lib/mitra-auth";
import { getClientIp, toDecimalString } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireMitraAccess();
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const outletId = url.searchParams.get("outletId") || "";
    const periodYm = url.searchParams.get("periodYm") || "";

    const defs = await db.select().from(mitraMetricDefs).orderBy(asc(mitraMetricDefs.label));

    const filters = [];
    if (outletId) filters.push(eq(mitraOutletMetrics.outletId, outletId));
    if (periodYm) filters.push(eq(mitraOutletMetrics.periodYm, periodYm));

    const rows = await db
        .select({
            id: mitraOutletMetrics.id,
            outletId: mitraOutletMetrics.outletId,
            outletName: mitraOutlets.name,
            outletCode: mitraOutlets.outletCode,
            metricDefId: mitraOutletMetrics.metricDefId,
            periodYm: mitraOutletMetrics.periodYm,
            value: mitraOutletMetrics.value,
            createdAt: mitraOutletMetrics.createdAt,
        })
        .from(mitraOutletMetrics)
        .innerJoin(mitraOutlets, eq(mitraOutletMetrics.outletId, mitraOutlets.id))
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(mitraOutletMetrics.createdAt))
        .limit(200);

    return NextResponse.json({ metricDefs: defs, metrics: rows });
}

export async function POST(request: Request) {
    const auth = await requireMitraAccess(["MANAGER", "ADMIN", "LEADER"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));

    if (body.type === "metric_def") {
        const manager = await requireMitraAccess(["MANAGER"]);
        if (manager.error) return manager.error;

        const id = uuid();
        await db.insert(mitraMetricDefs).values({
            id,
            key: String(body.key || "").trim(),
            label: String(body.label || "").trim(),
            unit: body.unit || null,
            aggregation: body.aggregation || "SUM",
            isPublic: Boolean(body.isPublic),
            createdAt: new Date(),
        });

        await writeMitraAuditLog({
            userId: manager.session?.userId,
            action: "CREATE",
            entity: "mitra_metric_def",
            entityId: id,
            diff: { key: body.key, label: body.label },
            ip: getClientIp(request),
        });

        const [created] = await db.select().from(mitraMetricDefs).where(eq(mitraMetricDefs.id, id));
        return NextResponse.json(created, { status: 201 });
    }

    const outletId = String(body.outletId || "");
    const metricDefId = String(body.metricDefId || "");
    const periodYm = String(body.periodYm || "");

    if (!outletId || !metricDefId || !/^\d{4}-\d{2}$/.test(periodYm)) {
        return NextResponse.json({ error: "Outlet, metric, dan periode YYYY-MM wajib diisi" }, { status: 400 });
    }

    if (auth.session?.role === "LEADER") {
        const territoryIds = await getLeaderTerritoryIds(auth.session.userId);
        const [outlet] = await db.select().from(mitraOutlets).where(eq(mitraOutlets.id, outletId)).limit(1);
        if (!outlet?.territoryId || !territoryIds.includes(outlet.territoryId)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    const [existing] = await db
        .select()
        .from(mitraOutletMetrics)
        .where(
            and(
                eq(mitraOutletMetrics.outletId, outletId),
                eq(mitraOutletMetrics.metricDefId, metricDefId),
                eq(mitraOutletMetrics.periodYm, periodYm)
            )
        )
        .limit(1);

    if (existing) {
        await db.update(mitraOutletMetrics).set({
            value: toDecimalString(body.value),
        }).where(eq(mitraOutletMetrics.id, existing.id));
    } else {
        await db.insert(mitraOutletMetrics).values({
            id: uuid(),
            outletId,
            metricDefId,
            periodYm,
            value: toDecimalString(body.value),
            createdAt: new Date(),
        });
    }

    await writeMitraAuditLog({
        userId: auth.session?.userId,
        action: existing ? "UPDATE" : "CREATE",
        entity: "mitra_outlet_metric",
        entityId: existing?.id || outletId,
        diff: { outletId, metricDefId, periodYm, value: body.value },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
