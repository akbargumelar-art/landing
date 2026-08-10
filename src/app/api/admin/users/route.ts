import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { adminUserProfiles, adminUserTaps, user, type AdminRole } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

const VALID_ROLES: AdminRole[] = ["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"];
const TAP_SCOPED: AdminRole[] = ["SUPERVISOR", "SALESFORCE"];

export async function GET() {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if (authResult.error) return authResult.error;

    const users = await db
        .select({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: adminUserProfiles.phone,
            role: adminUserProfiles.role,
            isActive: adminUserProfiles.isActive,
            lastLoginAt: adminUserProfiles.lastLoginAt,
            createdAt: user.createdAt,
        })
        .from(user)
        .leftJoin(adminUserProfiles, eq(user.id, adminUserProfiles.userId))
        .orderBy(asc(user.name));

    const assignments = await db.select().from(adminUserTaps);

    return NextResponse.json({
        users: users.map((row) => ({
            ...row,
            role: row.role || "SUPER_ADMIN",
            isActive: row.isActive ?? true,
            taps: assignments.filter((assignment) => assignment.userId === row.id).map((assignment) => assignment.tap),
        })),
    });
}

export async function POST(request: Request) {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if (authResult.error) return authResult.error;

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "");
    const taps = Array.isArray(body.taps) ? (body.taps as unknown[]).map(String).filter(Boolean) : [];

    if (!name || name.length < 2) {
        return NextResponse.json({ error: "Nama wajib diisi minimal 2 karakter" }, { status: 400 });
    }
    if (!email) {
        return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    }
    if (!password || password.length < 8) {
        return NextResponse.json({ error: "Password wajib diisi minimal 8 karakter" }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role as AdminRole)) {
        return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }
    if (TAP_SCOPED.includes(role as AdminRole) && taps.length === 0) {
        return NextResponse.json({ error: "Role ini wajib memiliki minimal satu TAP" }, { status: 400 });
    }

    let created;
    try {
        created = await auth.api.signUpEmail({ body: { name, email, password } });
    } catch (error) {
        console.error("Create admin user failed:", error);
        return NextResponse.json({ error: "Gagal membuat akun. Email mungkin sudah terdaftar." }, { status: 400 });
    }

    const userId = created.user.id;
    const phone = body.phone ? normalizePhoneE164(String(body.phone)) : null;

    await db.insert(adminUserProfiles).values({
        userId,
        phone,
        role: role as AdminRole,
        isActive: true,
        createdAt: new Date(),
    });

    if (taps.length > 0) {
        await db.insert(adminUserTaps).values(taps.map((tap) => ({ userId, tap })));
    }

    await writeAdminAuditLog({
        userId: authResult.session?.userId,
        action: "CREATE",
        entity: "admin_user",
        entityId: userId,
        diff: { name, email, role, tapCount: taps.length },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, userId }, { status: 201 });
}
