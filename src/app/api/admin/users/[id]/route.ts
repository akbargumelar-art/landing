import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { adminUserProfiles, adminUserTaps, type AdminRole } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

const VALID_ROLES: AdminRole[] = ["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"];
const TAP_SCOPED: AdminRole[] = ["SUPERVISOR", "SALESFORCE"];

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if (authResult.error) return authResult.error;

    const { id: userId } = await params;
    const body = await request.json().catch(() => ({}));
    const role = String(body.role || "");
    const taps = Array.isArray(body.taps) ? (body.taps as unknown[]).map(String).filter(Boolean) : [];

    if (!VALID_ROLES.includes(role as AdminRole)) {
        return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }
    if (TAP_SCOPED.includes(role as AdminRole) && taps.length === 0) {
        return NextResponse.json({ error: "Role ini wajib memiliki minimal satu TAP" }, { status: 400 });
    }
    if (userId === authResult.session?.userId && role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Tidak bisa menurunkan role akun sendiri" }, { status: 400 });
    }

    const [existing] = await db.select().from(adminUserProfiles).where(eq(adminUserProfiles.userId, userId)).limit(1);
    const values = {
        phone: body.phone ? normalizePhoneE164(String(body.phone)) : existing?.phone ?? null,
        role: role as AdminRole,
        isActive: body.isActive ?? existing?.isActive ?? true,
    };

    if (existing) {
        await db.update(adminUserProfiles).set(values).where(eq(adminUserProfiles.userId, userId));
    } else {
        await db.insert(adminUserProfiles).values({ userId, ...values, createdAt: new Date() });
    }

    await db.delete(adminUserTaps).where(eq(adminUserTaps.userId, userId));
    if (taps.length > 0) {
        await db.insert(adminUserTaps).values(taps.map((tap) => ({ userId, tap })));
    }

    await writeAdminAuditLog({
        userId: authResult.session?.userId,
        action: existing ? "UPDATE" : "CREATE",
        entity: "admin_user",
        entityId: userId,
        diff: { role, isActive: values.isActive, tapCount: taps.length },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
