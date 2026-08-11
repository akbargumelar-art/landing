import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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

/**
 * Apakah sistem sudah punya Super Admin sungguhan. Menjadi saklar yang menutup jalur
 * bootstrap: selama belum ada, instalasi baru butuh satu pintu masuk; begitu ada, pintu itu
 * tidak boleh tersisa.
 */
async function sudahAdaSuperAdmin(): Promise<boolean> {
    const [row] = await db
        .select({ userId: adminUserProfiles.userId })
        .from(adminUserProfiles)
        .where(and(eq(adminUserProfiles.role, "SUPER_ADMIN"), eq(adminUserProfiles.isActive, true)))
        .limit(1);

    return Boolean(row);
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

    /**
     * Jalur bootstrap: satu-satunya cara masuk pada instalasi yang belum punya profil admin
     * sama sekali. Dulu jalur ini permanen -- pengguna mana pun yang emailnya cocok dengan
     * email bootstrap (bawaannya nilai terdokumentasi publik) memperoleh SUPER_ADMIN penuh
     * meski tidak punya profil, sehingga seluruh matriks role bisa dilewati tanpa assignment.
     *
     * Sekarang jalur itu menutup sendiri begitu ada satu Super Admin aktif yang sah, dan
     * setiap pemakaiannya dicatat -- kalau sampai terpakai di sistem yang sudah berjalan,
     * jejaknya harus ada.
     */
    if (!profile) {
        const bootstrapEmail = (
            process.env.ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAIL ||
            process.env.MITRA_BOOTSTRAP_MANAGER_EMAIL ||
            "admin@abkciraya.com"
        ).toLowerCase();

        if (session.user.email?.toLowerCase() !== bootstrapEmail) return null;
        if (await sudahAdaSuperAdmin()) return null;

        await writeAdminAuditLog({
            userId: session.user.id,
            action: "BOOTSTRAP_ACCESS",
            entity: "admin_user_profile",
            entityId: session.user.id,
            diff: { email: session.user.email },
        });

        return {
            userId: session.user.id,
            name: session.user.name || "Admin",
            email: session.user.email || "",
            role: "SUPER_ADMIN",
            isActive: true,
        };
    }

    /**
     * Akun terkunci diperlakukan sama dengan akun nonaktif dan ditolak di sini -- sebelum
     * peran maupun scope sempat diperiksa. Kolom lockedUntil sudah lama ada di tabel tetapi
     * tidak pernah dibaca, sehingga lockout praktis tidak berlaku.
     */
    const terkunci = Boolean(profile.lockedUntil && profile.lockedUntil.getTime() > Date.now());

    return {
        userId: session.user.id,
        name: session.user.name || "Admin",
        email: session.user.email || "",
        role: profile.role as AdminRole,
        isActive: profile.isActive && !terkunci,
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
