import { NextResponse } from "next/server";
import {and, asc, count, desc, eq, like, lt, type SQL} from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import {
    adminAuditLogs,
    mitraDetailSessions,
    mitraOtpRequests,
    mitraTerritories,
    user,
} from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getMitraAdminSummary } from "@/lib/mitra-data";
import { getClientIp } from "@/lib/mitra-utils";
import { testWahaConnection } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const resource = new URL(request.url).searchParams.get("resource") || "summary";

    if (resource === "health") {
        const admin = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
        if (admin.error) return admin.error;

        /**
         * Memakai testWahaConnection() yang sama dengan jalur pengiriman, bukan pemeriksaan
         * sendiri.
         *
         * Versi sebelumnya membaca API key HANYA dari process.env.WAHA_API_KEY, padahal
         * getWahaConfig() mengutamakan wa_gw_token dari Pengaturan. Bila token diisi lewat
         * halaman Pengaturan -- cara yang memang dianjurkan -- permintaan pemeriksaan
         * terkirim tanpa header X-Api-Key, WAHA membalas 401, dan indikator menyatakan
         * "tidak terjangkau" padahal pengiriman OTP berjalan normal.
         *
         * Perbedaan lain yang ikut hilang: endpoint /api/server/status (versi lama) vs
         * /api/sessions/{session} yang benar-benar dipakai, dan timeout 3 detik yang terlalu
         * pendek untuk server yang sedang sibuk.
         */
        const waha = await testWahaConnection();

        return NextResponse.json({
            database: { ok: true },
            waha: {
                configured: waha.configured,
                reachable: waha.reachable,
                session: waha.session,
                sessionStatus: waha.sessionStatus,
                // Alasan spesifik supaya admin tahu harus memperbaiki apa, bukan sekadar
                // "tidak terjangkau" yang tidak bisa ditindaklanjuti.
                error: waha.error,
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
