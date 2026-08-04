import { NextResponse } from "next/server";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOutlets, mitraTerritories, mitraWhitelistNumbers } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET() {
    // Whitelist berada di halaman Pengaturan, dan seluruh grup "Sistem & Konten" kini
    // khusus Admin Super atas permintaan pemilik aplikasi - menggantikan baris View-all
    // untuk Manager pada matriks di prd-total-revamp.md 2.2.
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const whitelist = await db
        .select({
            id: mitraWhitelistNumbers.id,
            phoneE164: mitraWhitelistNumbers.phoneE164,
            name: mitraWhitelistNumbers.name,
            scope: mitraWhitelistNumbers.scope,
            outletId: mitraWhitelistNumbers.outletId,
            outletName: mitraOutlets.name,
            territoryId: mitraWhitelistNumbers.territoryId,
            territoryName: mitraTerritories.name,
            isActive: mitraWhitelistNumbers.isActive,
            expiresAt: mitraWhitelistNumbers.expiresAt,
            createdAt: mitraWhitelistNumbers.createdAt,
        })
        .from(mitraWhitelistNumbers)
        .leftJoin(mitraOutlets, eq(mitraWhitelistNumbers.outletId, mitraOutlets.id))
        .leftJoin(mitraTerritories, eq(mitraWhitelistNumbers.territoryId, mitraTerritories.id))
        .orderBy(desc(mitraWhitelistNumbers.createdAt))
        .limit(500);

    const outlets = await db.select({ id: mitraOutlets.id, name: mitraOutlets.name, outletCode: mitraOutlets.outletCode }).from(mitraOutlets).orderBy(asc(mitraOutlets.name));
    const territories = await db.select().from(mitraTerritories).orderBy(asc(mitraTerritories.name));

    return NextResponse.json({ whitelist, outlets, territories });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const scope = body.scope || "ALL";

    // Bulk add: `phones` is a newline/comma separated list or an array of numbers.
    // Every row shares the same scope, so scope validation below runs once for all of them.
    if (body.phones !== undefined) {
        return handleBulkCreate(request, body, scope, auth.session?.userId);
    }

    const phoneE164 = normalizePhoneE164(String(body.phoneE164 || body.phone || ""));

    if (!phoneE164) {
        return NextResponse.json({ error: "Nomor WhatsApp wajib diisi" }, { status: 400 });
    }
    if (scope === "OUTLET" && !body.outletId) {
        return NextResponse.json({ error: "Scope OUTLET membutuhkan outlet" }, { status: 400 });
    }
    if (scope === "TERRITORY" && !body.territoryId) {
        return NextResponse.json({ error: "Scope TERRITORY membutuhkan wilayah" }, { status: 400 });
    }

    const id = uuid();
    await db.insert(mitraWhitelistNumbers).values({
        id,
        phoneE164,
        name: body.name || null,
        scope,
        outletId: scope === "OUTLET" ? body.outletId : null,
        territoryId: scope === "TERRITORY" ? body.territoryId : null,
        isActive: body.isActive ?? true,
        createdBy: auth.session?.userId,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdAt: new Date(),
    });

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "CREATE",
        entity: "mitra_whitelist",
        entityId: id,
        diff: { phoneE164, scope },
        ip: getClientIp(request),
    });

    const [created] = await db.select().from(mitraWhitelistNumbers).where(eq(mitraWhitelistNumbers.id, id));
    return NextResponse.json(created, { status: 201 });
}

async function handleBulkCreate(
    request: Request,
    body: Record<string, unknown>,
    scope: string,
    userId?: string
) {
    if (scope === "OUTLET" && !body.outletId) {
        return NextResponse.json({ error: "Scope OUTLET membutuhkan outlet" }, { status: 400 });
    }
    if (scope === "TERRITORY" && !body.territoryId) {
        return NextResponse.json({ error: "Scope TERRITORY membutuhkan wilayah" }, { status: 400 });
    }

    const rawList = Array.isArray(body.phones)
        ? (body.phones as unknown[]).map(String)
        : String(body.phones || "").split(/[\n,;]+/);

    const invalid: string[] = [];
    const normalized: string[] = [];
    for (const raw of rawList) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const phone = normalizePhoneE164(trimmed);
        if (phone) normalized.push(phone);
        else invalid.push(trimmed);
    }

    const unique = Array.from(new Set(normalized));
    if (unique.length === 0) {
        return NextResponse.json({ error: "Tidak ada nomor WhatsApp yang valid" }, { status: 400 });
    }

    const existing = await db
        .select({ phoneE164: mitraWhitelistNumbers.phoneE164 })
        .from(mitraWhitelistNumbers)
        .where(inArray(mitraWhitelistNumbers.phoneE164, unique));
    const existingSet = new Set(existing.map((row) => row.phoneE164));
    const toInsert = unique.filter((phone) => !existingSet.has(phone));

    if (toInsert.length > 0) {
        const now = new Date();
        await db.insert(mitraWhitelistNumbers).values(toInsert.map((phoneE164) => ({
            id: uuid(),
            phoneE164,
            name: null,
            scope: scope as "ALL" | "OUTLET" | "TERRITORY",
            outletId: scope === "OUTLET" ? String(body.outletId) : null,
            territoryId: scope === "TERRITORY" ? String(body.territoryId) : null,
            isActive: true,
            createdBy: userId,
            expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null,
            createdAt: now,
        })));

        await writeAdminAuditLog({
            userId,
            action: "CREATE_BULK",
            entity: "mitra_whitelist",
            diff: { scope, added: toInsert.length, skippedExisting: existingSet.size, invalid: invalid.length },
            ip: getClientIp(request),
        });
    }

    return NextResponse.json({
        added: toInsert.length,
        skippedExisting: unique.length - toInsert.length,
        invalid,
    }, { status: 201 });
}
