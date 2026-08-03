import { NextResponse } from "next/server";
import { and, asc, count, desc, eq, inArray, like, lt, type SQL } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import {
    adminAuditLogs,
    mitraDetailSessions,
    mitraOtpRequests,
    mitraTerritories,
    siteSettings,
    user,
} from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getMitraAdminSummary } from "@/lib/mitra-data";
import { getClientIp } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const resource = new URL(request.url).searchParams.get("resource") || "summary";

    if (resource === "health") {
        const admin = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
        if (admin.error) return admin.error;

        const settings = await db
            .select({ key: siteSettings.key, value: siteSettings.value })
            .from(siteSettings)
            .where(inArray(siteSettings.key, ["wa_gw_endpoint", "wa_gw_session"]));
        const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
        const endpoint = settingMap.get("wa_gw_endpoint") || process.env.WAHA_BASE_URL || "";
        let reachable = false;

        if (endpoint) {
            try {
                const origin = new URL(endpoint).origin;
                const response = await fetch(`${origin}/api/server/status`, {
                    headers: process.env.WAHA_API_KEY ? { "X-Api-Key": process.env.WAHA_API_KEY } : undefined,
                    signal: AbortSignal.timeout(3000),
                    cache: "no-store",
                });
                reachable = response.ok;
            } catch {
                reachable = false;
            }
        }

        return NextResponse.json({
            database: { ok: true },
            waha: {
                configured: Boolean(endpoint),
                reachable,
                session: settingMap.get("wa_gw_session") || process.env.WAHA_SESSION || "default",
            },
        });
    }

    if (resource === "territories") {
        const admin = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
        if (admin.error) return admin.error;

        const territories = await db.select().from(mitraTerritories).orderBy(asc(mitraTerritories.type), asc(mitraTerritories.name));
        return NextResponse.json({ territories });
    }

    if (resource === "audit") {
        const superAdmin = await requireRole(["SUPER_ADMIN"]);
        if (superAdmin.error) return superAdmin.error;

        const url = new URL(request.url);
        const action = url.searchParams.get("action") || "";
        const entity = url.searchParams.get("entity") || "";
        const q = url.searchParams.get("q") || "";
        const filters: SQL[] = [];

        if (action) filters.push(eq(adminAuditLogs.action, action));
        if (entity) filters.push(eq(adminAuditLogs.entity, entity));
        if (q) filters.push(like(adminAuditLogs.entityId, `%${q}%`));

        const logs = await db
            .select({
                id: adminAuditLogs.id,
                action: adminAuditLogs.action,
                entity: adminAuditLogs.entity,
                entityId: adminAuditLogs.entityId,
                diffJson: adminAuditLogs.diffJson,
                ip: adminAuditLogs.ip,
                createdAt: adminAuditLogs.createdAt,
                userName: user.name,
                userEmail: user.email,
            })
            .from(adminAuditLogs)
            .leftJoin(user, eq(adminAuditLogs.userId, user.id))
            .where(filters.length > 0 ? and(...filters) : undefined)
            .orderBy(desc(adminAuditLogs.createdAt))
            .limit(300);

        return NextResponse.json({ logs });
    }

    const summary = await getMitraAdminSummary();
    return NextResponse.json({ summary, user: auth.session });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const resource = String(body.resource || "");

    if (resource === "cleanup") {
        const now = new Date();
        const [[otpCount], [sessionCount]] = await Promise.all([
            db.select({ value: count() }).from(mitraOtpRequests).where(lt(mitraOtpRequests.expiresAt, now)),
            db.select({ value: count() }).from(mitraDetailSessions).where(lt(mitraDetailSessions.expiresAt, now)),
        ]);

        await db.transaction(async (tx) => {
            await tx.delete(mitraOtpRequests).where(lt(mitraOtpRequests.expiresAt, now));
            await tx.delete(mitraDetailSessions).where(lt(mitraDetailSessions.expiresAt, now));
        });

        const removed = {
            otpRequests: otpCount?.value || 0,
            detailSessions: sessionCount?.value || 0,
        };
        await writeAdminAuditLog({
            userId: auth.session?.userId,
            action: "CLEANUP",
            entity: "mitra_access_session",
            diff: removed,
            ip: getClientIp(request),
        });

        return NextResponse.json({ success: true, removed });
    }

    if (resource === "territory") {
        const id = uuid();
        const type = String(body.type || "AREA");

        if (!body.name || !["REGION", "CLUSTER", "AREA"].includes(type)) {
            return NextResponse.json({ error: "Nama dan tipe wilayah wajib valid" }, { status: 400 });
        }

        await db.insert(mitraTerritories).values({
            id,
            name: String(body.name),
            type: type as "REGION" | "CLUSTER" | "AREA",
            parentId: body.parentId || null,
            createdAt: new Date(),
        });

        await writeAdminAuditLog({
            userId: auth.session?.userId,
            action: "CREATE",
            entity: "mitra_territory",
            entityId: id,
            diff: { name: body.name, type },
            ip: getClientIp(request),
        });

        const [created] = await db.select().from(mitraTerritories).where(eq(mitraTerritories.id, id));
        return NextResponse.json(created, { status: 201 });
    }

    return NextResponse.json({ error: "Resource tidak valid" }, { status: 400 });
}
