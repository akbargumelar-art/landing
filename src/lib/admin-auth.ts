import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
    adminAuditLogs,
    adminUserProfiles,
    adminUserTaps,
    type AdminRole,
} from "@/db/schema";

export type { AdminRole };

export interface AdminSession {
    userId: string;
    name: string;
    email: string;
    role: AdminRole;
    isActive: boolean;
}

const TAP_SCOPED_ROLES: AdminRole[] = ["SUPERVISOR", "SALESFORCE"];

export function isTapScopedRole(role: AdminRole): boolean {
    return TAP_SCOPED_ROLES.includes(role);
}

export async function getAdminSession(): Promise<AdminSession | null> {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user?.id) return null;

    const [profile] = await db
        .select()
        .from(adminUserProfiles)
        .where(eq(adminUserProfiles.userId, session.user.id))
        .limit(1);

    const bootstrapEmail = (
        process.env.ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAIL ||
        process.env.MITRA_BOOTSTRAP_MANAGER_EMAIL ||
        "admin@abkciraya.com"
    ).toLowerCase();
    if (!profile && session.user.email?.toLowerCase() !== bootstrapEmail) return null;

    return {
        userId: session.user.id,
        name: session.user.name || "Admin",
        email: session.user.email || "",
        role: (profile?.role || "SUPER_ADMIN") as AdminRole,
        isActive: profile?.isActive ?? true,
    };
}

export async function requireRole(roles: AdminRole[]) {
    let session: AdminSession | null;
    try {
        session = await getAdminSession();
    } catch (error) {
        console.error("requireRole session lookup failed:", error);
        return {
            error: NextResponse.json({ error: "Layanan sedang gangguan, coba lagi." }, { status: 503 }),
            session: null,
        };
    }

    if (!session) {
        return {
            error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
            session: null,
        };
    }

    if (!session.isActive || !roles.includes(session.role)) {
        return {
            error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            session: null,
        };
    }

    return { error: null, session };
}

export async function getUserTaps(userId: string): Promise<string[]> {
    const rows = await db
        .select({ tap: adminUserTaps.tap })
        .from(adminUserTaps)
        .where(eq(adminUserTaps.userId, userId));

    return rows.map((row) => row.tap);
}

export async function writeAdminAuditLog(input: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    diff?: Record<string, unknown> | null;
    ip?: string | null;
}) {
    await db.insert(adminAuditLogs).values({
        id: uuid(),
        userId: input.userId || null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId || null,
        diffJson: sanitizeAuditDiff(input.diff || null),
        ip: input.ip || null,
        createdAt: new Date(),
    });
}

function sanitizeAuditDiff(diff: Record<string, unknown> | null) {
    if (!diff) return null;

    const blocked = new Set([
        "password",
        "passwordHash",
        "password_hash",
        "otp",
        "code",
        "codeHash",
        "code_hash",
        "token",
        "tokenHash",
        "token_hash",
        "wa_gw_token",
        "authSecret",
    ]);

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(diff)) {
        if (blocked.has(key)) continue;
        result[key] = value;
    }

    return result;
}
