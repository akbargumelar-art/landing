import { NextResponse } from "next/server";
import { and, asc, count, desc, eq, inArray, like, lt, type SQL } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import {
    mitraAuditLogs,
    mitraDetailSessions,
    mitraOtpRequests,
    mitraTerritories,
    mitraUserProfiles,
    mitraUserTerritories,
    siteSettings,
    user,
} from "@/db/schema";
import { requireMitraAccess, writeMitraAuditLog } from "@/lib/mitra-auth";
import { getMitraAdminSummary } from "@/lib/mitra-data";
import { getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireMitraAccess();
    if (auth.error) return auth.error;

    const resource = new URL(request.url).searchParams.get("resource") || "summary";

    if (resource === "health") {
        const admin = await requireMitraAccess(["MANAGER", "ADMIN"]);
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
        const manager = await requireMitraAccess(["MANAGER"]);
        if (manager.error) return manager.error;

        const territories = await db.select().from(mitraTerritories).orderBy(asc(mitraTerritories.type), asc(mitraTerritories.name));
        return NextResponse.json({ territories });
    }

    if (resource === "users") {
        const manager = await requireMitraAccess(["MANAGER"]);
        if (manager.error) return manager.error;

        const users = await db
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
                phone: mitraUserProfiles.phone,
                role: mitraUserProfiles.role,
                isActive: mitraUserProfiles.isActive,
                createdAt: user.createdAt,
            })
            .from(user)
            .leftJoin(mitraUserProfiles, eq(user.id, mitraUserProfiles.userId))
            .orderBy(asc(user.name));

        const assignments = await db.select().from(mitraUserTerritories);
        const territories = await db.select().from(mitraTerritories).orderBy(asc(mitraTerritories.name));

        return NextResponse.json({
            users: users.map((row) => ({
                ...row,
                role: row.role || "MANAGER",
                isActive: row.isActive ?? true,
                territoryIds: assignments.filter((assignment) => assignment.userId === row.id).map((assignment) => assignment.territoryId),
            })),
            territories,
        });
    }

    if (resource === "audit") {
        const manager = await requireMitraAccess(["MANAGER"]);
        if (manager.error) return manager.error;

        const url = new URL(request.url);
        const action = url.searchParams.get("action") || "";
        const entity = url.searchParams.get("entity") || "";
        const q = url.searchParams.get("q") || "";
        const filters: SQL[] = [];

        if (action) filters.push(eq(mitraAuditLogs.action, action));
        if (entity) filters.push(eq(mitraAuditLogs.entity, entity));
        if (q) filters.push(like(mitraAuditLogs.entityId, `%${q}%`));

        const logs = await db
            .select({
                id: mitraAuditLogs.id,
                action: mitraAuditLogs.action,
                entity: mitraAuditLogs.entity,
                entityId: mitraAuditLogs.entityId,
                diffJson: mitraAuditLogs.diffJson,
                ip: mitraAuditLogs.ip,
                createdAt: mitraAuditLogs.createdAt,
                userName: user.name,
                userEmail: user.email,
            })
            .from(mitraAuditLogs)
            .leftJoin(user, eq(mitraAuditLogs.userId, user.id))
            .where(filters.length > 0 ? and(...filters) : undefined)
            .orderBy(desc(mitraAuditLogs.createdAt))
            .limit(300);

        return NextResponse.json({ logs });
    }

    const summary = await getMitraAdminSummary();
    return NextResponse.json({ summary, user: auth.session });
}

export async function POST(request: Request) {
    const auth = await requireMitraAccess(["MANAGER"]);
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
        await writeMitraAuditLog({
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

        await writeMitraAuditLog({
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

    if (resource === "user_profile") {
        const userId = String(body.userId || "");
        if (!userId || !["MANAGER", "ADMIN", "LEADER"].includes(String(body.role || ""))) {
            return NextResponse.json({ error: "User dan role wajib valid" }, { status: 400 });
        }

        const [existing] = await db.select().from(mitraUserProfiles).where(eq(mitraUserProfiles.userId, userId)).limit(1);
        const values = {
            phone: body.phone ? normalizePhoneE164(String(body.phone)) : null,
            role: body.role as "MANAGER" | "ADMIN" | "LEADER",
            isActive: body.isActive ?? true,
        };

        if (existing) {
            await db.update(mitraUserProfiles).set(values).where(eq(mitraUserProfiles.userId, userId));
        } else {
            await db.insert(mitraUserProfiles).values({
                userId,
                ...values,
                createdAt: new Date(),
            });
        }

        await db.delete(mitraUserTerritories).where(eq(mitraUserTerritories.userId, userId));
        const territoryIds = Array.isArray(body.territoryIds) ? (body.territoryIds as unknown[]).map(String) : [];
        if (territoryIds.length > 0) {
            await db.insert(mitraUserTerritories).values(territoryIds.map((territoryId) => ({ userId, territoryId })));
        }

        await writeMitraAuditLog({
            userId: auth.session?.userId,
            action: existing ? "UPDATE" : "CREATE",
            entity: "mitra_user_profile",
            entityId: userId,
            diff: { role: body.role, isActive: body.isActive, territoryCount: territoryIds.length },
            ip: getClientIp(request),
        });

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Resource tidak valid" }, { status: 400 });
}
