import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { adminUserProfiles, adminUserTaps, mitraSalesforces, user, type AdminRole } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { validateAdminAssignment } from "@/lib/admin-assignment";
import { getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

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
            salesforceId: adminUserProfiles.salesforceId,
            salesforceName: mitraSalesforces.name,
            createdAt: user.createdAt,
        })
        .from(user)
        .leftJoin(adminUserProfiles, eq(user.id, adminUserProfiles.userId))
        .leftJoin(mitraSalesforces, eq(adminUserProfiles.salesforceId, mitraSalesforces.id))
        .orderBy(asc(user.name));

    const assignments = await db.select().from(adminUserTaps);

    // Master salesforce yang masih aktif, untuk mengisi pemilih di form akun. Yang sudah
    // tertaut ke akun lain tetap dikirim tetapi ditandai, supaya Super Admin melihat sebabnya
    // alih-alih mendapati pilihannya hilang tanpa penjelasan.
    const masterSalesforce = await db
        .select({ id: mitraSalesforces.id, name: mitraSalesforces.name, tap: mitraSalesforces.tap })
        .from(mitraSalesforces)
        .where(eq(mitraSalesforces.isActive, true))
        .orderBy(asc(mitraSalesforces.name));

    const sudahTertaut = new Set(users.map((row) => row.salesforceId).filter(Boolean));

    return NextResponse.json({
        users: users.map((row) => ({
            ...row,
            role: row.role || "SUPER_ADMIN",
            isActive: row.isActive ?? true,
            taps: assignments.filter((assignment) => assignment.userId === row.id).map((assignment) => assignment.tap),
        })),
        salesforceOptions: masterSalesforce.map((row) => ({ ...row, taken: sudahTertaut.has(row.id) })),
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
    // Assignment divalidasi SEBELUM akun dibuat: bila ditolak setelah signUpEmail berhasil,
    // yang tertinggal adalah akun tanpa profil -- persis kondisi yang jalur bootstrap dulu
    // perlakukan secara istimewa.
    const assignment = await validateAdminAssignment({ role, taps, salesforceId: body.salesforceId });
    if (assignment.error) return assignment.error;

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
        salesforceId: assignment.salesforceId,
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
