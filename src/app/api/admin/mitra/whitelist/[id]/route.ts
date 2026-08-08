import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraWhitelistNumbers } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const [existing] = await db.select().from(mitraWhitelistNumbers).where(eq(mitraWhitelistNumbers.id, id)).limit(1);

    if (!existing) {
        return NextResponse.json({ error: "Whitelist tidak ditemukan" }, { status: 404 });
    }

    const scope = body.scope || existing.scope;
    await db.update(mitraWhitelistNumbers).set({
        phoneE164: body.phoneE164 || body.phone ? normalizePhoneE164(String(body.phoneE164 || body.phone)) : existing.phoneE164,
        name: body.name === "" ? null : body.name ?? existing.name,
        keterangan: body.keterangan === "" ? null : body.keterangan ?? existing.keterangan,
        scope,
        outletId: scope === "OUTLET" ? body.outletId ?? existing.outletId : null,
        tap: scope === "TAP" ? String(body.tap ?? existing.tap ?? "").trim() || null : null,
        isActive: body.isActive ?? existing.isActive,
        expiresAt: body.expiresAt === "" ? null : body.expiresAt ? new Date(body.expiresAt) : existing.expiresAt,
    }).where(eq(mitraWhitelistNumbers.id, id));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "UPDATE",
        entity: "mitra_whitelist",
        entityId: id,
        diff: { scope, isActive: body.isActive },
        ip: getClientIp(request),
    });

    const [updated] = await db.select().from(mitraWhitelistNumbers).where(eq(mitraWhitelistNumbers.id, id));
    return NextResponse.json(updated);
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const [existing] = await db.select().from(mitraWhitelistNumbers).where(eq(mitraWhitelistNumbers.id, id)).limit(1);

    if (!existing) {
        return NextResponse.json({ error: "Whitelist tidak ditemukan" }, { status: 404 });
    }

    await db.delete(mitraWhitelistNumbers).where(eq(mitraWhitelistNumbers.id, id));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "DELETE",
        entity: "mitra_whitelist",
        entityId: id,
        diff: { phoneE164: existing.phoneE164, scope: existing.scope },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
