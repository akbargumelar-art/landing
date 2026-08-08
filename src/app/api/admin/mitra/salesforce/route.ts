import { NextResponse } from "next/server";
import { asc, count, eq, like, or, type SQL } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOutlets, mitraSalesforces } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";
import { normalizeSalesforceName } from "@/lib/mitra-salesforce";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const q = (new URL(request.url).searchParams.get("q") || "").trim();
    const where: SQL | undefined = q
        ? or(like(mitraSalesforces.name, `%${q}%`), like(mitraSalesforces.tap, `%${q}%`))
        : undefined;

    // Jumlah outlet ikut dihitung supaya admin tahu dampak sebelum menghapus atau
    // mengganti nama seorang salesforce.
    const rows = await db
        .select({
            id: mitraSalesforces.id,
            name: mitraSalesforces.name,
            photoUrl: mitraSalesforces.photoUrl,
            phone: mitraSalesforces.phone,
            tap: mitraSalesforces.tap,
            isActive: mitraSalesforces.isActive,
            outletCount: count(mitraOutlets.id),
        })
        .from(mitraSalesforces)
        .leftJoin(mitraOutlets, eq(mitraOutlets.salesforceId, mitraSalesforces.id))
        .where(where)
        .groupBy(mitraSalesforces.id)
        .orderBy(asc(mitraSalesforces.name))
        .limit(500);

    return NextResponse.json({ salesforces: rows });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const name = normalizeSalesforceName(body.name);

    if (!name) return NextResponse.json({ error: "Nama salesforce wajib diisi" }, { status: 400 });

    const [duplikat] = await db
        .select({ id: mitraSalesforces.id })
        .from(mitraSalesforces)
        .where(eq(mitraSalesforces.name, name))
        .limit(1);

    if (duplikat) return NextResponse.json({ error: "Nama salesforce ini sudah terdaftar" }, { status: 409 });

    const id = uuid();
    await db.insert(mitraSalesforces).values({
        id,
        name,
        photoUrl: body.photoUrl || null,
        phone: body.phone ? normalizePhoneE164(String(body.phone)) : null,
        tap: String(body.tap || ""),
        isActive: body.isActive !== false,
        createdAt: new Date(),
    });

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "CREATE",
        entity: "mitra_salesforce",
        entityId: id,
        diff: { name },
        ip: getClientIp(request),
    });

    const [saved] = await db.select().from(mitraSalesforces).where(eq(mitraSalesforces.id, id)).limit(1);
    return NextResponse.json(saved);
}

export async function PUT(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    const [existing] = await db.select().from(mitraSalesforces).where(eq(mitraSalesforces.id, id)).limit(1);

    if (!existing) return NextResponse.json({ error: "Salesforce tidak ditemukan" }, { status: 404 });

    const name = body.name === undefined ? existing.name : normalizeSalesforceName(body.name);
    if (!name) return NextResponse.json({ error: "Nama salesforce wajib diisi" }, { status: 400 });

    if (name !== existing.name) {
        const [duplikat] = await db
            .select({ id: mitraSalesforces.id })
            .from(mitraSalesforces)
            .where(eq(mitraSalesforces.name, name))
            .limit(1);

        if (duplikat) return NextResponse.json({ error: "Nama salesforce ini sudah terdaftar" }, { status: 409 });
    }

    await db
        .update(mitraSalesforces)
        .set({
            name,
            photoUrl: body.photoUrl === "" ? null : body.photoUrl ?? existing.photoUrl,
            phone: body.phone === "" ? null : body.phone ? normalizePhoneE164(String(body.phone)) : existing.phone,
            tap: body.tap === undefined ? existing.tap : String(body.tap || ""),
            isActive: body.isActive === undefined ? existing.isActive : body.isActive !== false,
        })
        .where(eq(mitraSalesforces.id, id));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "UPDATE",
        entity: "mitra_salesforce",
        entityId: id,
        // Ganti nama menyentuh seluruh outlet yang menautinya, jadi nama lama dicatat.
        diff: { namaLama: existing.name, namaBaru: name },
        ip: getClientIp(request),
    });

    const [updated] = await db.select().from(mitraSalesforces).where(eq(mitraSalesforces.id, id)).limit(1);
    return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const id = new URL(request.url).searchParams.get("id") || "";
    const [existing] = await db.select().from(mitraSalesforces).where(eq(mitraSalesforces.id, id)).limit(1);

    if (!existing) return NextResponse.json({ error: "Salesforce tidak ditemukan" }, { status: 404 });

    // Outlet tidak ikut terhapus: FK-nya ON DELETE SET NULL, jadi outlet hanya kehilangan
    // penautannya dan bisa ditautkan ulang.
    await db.delete(mitraSalesforces).where(eq(mitraSalesforces.id, id));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "DELETE",
        entity: "mitra_salesforce",
        entityId: id,
        diff: { name: existing.name },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
