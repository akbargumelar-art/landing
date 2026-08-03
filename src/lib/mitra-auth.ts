import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
    mitraAuditLogs,
    mitraUserProfiles,
    mitraUserTerritories,
    type MitraRole,
} from "@/db/schema";

export interface MitraSession {
    userId: string;
    name: string;
    email: string;
    role: MitraRole;
    isActive: boolean;
}

export async function getMitraSession(): Promise<MitraSession | null> {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user?.id) return null;

    const [profile] = await db
        .select()
        .from(mitraUserProfiles)
        .where(eq(mitraUserProfiles.userId, session.user.id))
        .limit(1);

    const bootstrapEmail = (process.env.MITRA_BOOTSTRAP_MANAGER_EMAIL || "admin@abkciraya.com").toLowerCase();
    if (!profile && session.user.email?.toLowerCase() !== bootstrapEmail) return null;

    return {
        userId: session.user.id,
        name: session.user.name || "Admin",
        email: session.user.email || "",
        role: (profile?.role || "MANAGER") as MitraRole,
        isActive: profile?.isActive ?? true,
    };
}

export async function requireMitraAccess(roles: MitraRole[] = ["MANAGER", "ADMIN", "LEADER"]) {
    const session = await getMitraSession();

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

export async function getLeaderTerritoryIds(userId: string): Promise<string[]> {
    const rows = await db
        .select({ territoryId: mitraUserTerritories.territoryId })
        .from(mitraUserTerritories)
        .where(eq(mitraUserTerritories.userId, userId));

    return rows.map((row) => row.territoryId);
}

export async function writeMitraAuditLog(input: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    diff?: Record<string, unknown> | null;
    ip?: string | null;
}) {
    await db.insert(mitraAuditLogs).values({
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
