import { NextResponse } from "next/server";
import { and, asc, count, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOutletDetails, mitraOutlets, mitraTerritories } from "@/db/schema";
import { getUserTerritoryIds, isTerritoryScopedRole, requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { MITRA_DETAIL_FIELD_GROUPS, sanitizeDetailGroup } from "@/lib/mitra-fields";
import { generatePublicToken, getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const status = url.searchParams.get("status") || "";
    const page = Math.max(Number(url.searchParams.get("page") || "1"), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || "25"), 1), 100);

    const filters: SQL[] = [];
    if (q) {
        filters.push(or(
            like(mitraOutlets.name, `%${q}%`),
            like(mitraOutlets.outletCode, `%${q}%`),
            like(mitraOutlets.kabupaten, `%${q}%`),
            like(mitraOutlets.kecamatan, `%${q}%`),
            like(mitraOutlets.ownerPhone, `%${q}%`)
        ) as SQL);
    }
    if (["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
        filters.push(eq(mitraOutlets.status, status as "ACTIVE" | "INACTIVE" | "SUSPENDED"));
    }

    if (auth.session && isTerritoryScopedRole(auth.session.role)) {
        const territoryIds = await getUserTerritoryIds(auth.session.userId);
        if (territoryIds.length === 0) {
            return NextResponse.json({ outlets: [], total: 0, page, pageSize });
        }
        filters.push(inArray(mitraOutlets.territoryId, territoryIds));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = await db.select({ value: count() }).from(mitraOutlets).where(where);
    const outlets = await db
        .select({
            id: mitraOutlets.id,
            outletCode: mitraOutlets.outletCode,
            publicToken: mitraOutlets.publicToken,
            rsNumber: mitraOutlets.rsNumber,
            name: mitraOutlets.name,
            ownerName: mitraOutlets.ownerName,
            ownerPhone: mitraOutlets.ownerPhone,
            tap: mitraOutlets.tap,
            salesforce: mitraOutlets.salesforce,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
            longitude: mitraOutlets.longitude,
            latitude: mitraOutlets.latitude,
            locationUrl: mitraOutlets.locationUrl,
            territoryId: mitraOutlets.territoryId,
            territoryName: mitraTerritories.name,
            category: mitraOutlets.category,
            pjpDay: mitraOutlets.pjpDay,
            pjpType: mitraOutlets.pjpType,
            branding: mitraOutlets.branding,
            status: mitraOutlets.status,
            photoUrl: mitraOutlets.photoUrl,
            createdAt: mitraOutlets.createdAt,
        })
        .from(mitraOutlets)
        .leftJoin(mitraTerritories, eq(mitraOutlets.territoryId, mitraTerritories.id))
        .where(where)
        .orderBy(desc(mitraOutlets.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

    const territories = await db.select().from(mitraTerritories).orderBy(asc(mitraTerritories.name));

    return NextResponse.json({
        outlets,
        territories,
        total: totalRow?.value || 0,
        page,
        pageSize,
    });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const id = uuid();

    if (!body.outletCode || !body.name || !body.ownerPhone) {
        return NextResponse.json({ error: "Kode outlet, nama outlet, dan nomor owner wajib diisi" }, { status: 400 });
    }

    await db.insert(mitraOutlets).values({
        id,
        outletCode: String(body.outletCode).trim(),
        publicToken: generatePublicToken(),
        rsNumber: String(body.rsNumber || ""),
        name: String(body.name || "").trim(),
        ownerName: String(body.ownerName || ""),
        ownerPhone: normalizePhoneE164(String(body.ownerPhone || "")),
        tap: String(body.tap || ""),
        salesforce: String(body.salesforce || ""),
        kabupaten: String(body.kabupaten || ""),
        kecamatan: String(body.kecamatan || ""),
        longitude: body.longitude === "" || body.longitude === undefined ? null : Number(body.longitude),
        latitude: body.latitude === "" || body.latitude === undefined ? null : Number(body.latitude),
        locationUrl: body.locationUrl || null,
        territoryId: body.territoryId || null,
        category: body.category || "FISIK",
        pjpDay: body.pjpDay || "Senin",
        pjpType: body.pjpType || "F1",
        branding: body.branding || "",
        status: body.status || "ACTIVE",
        photoUrl: body.photoUrl || null,
        createdAt: now,
    });

    await db.insert(mitraOutletDetails).values({
        outletId: id,
        sellthruDigiposJson: sanitizeDetailGroup(body.sellthruDigipos, MITRA_DETAIL_FIELD_GROUPS[0].fields.map((field) => field.key)),
        sellthruNotaJson: sanitizeDetailGroup(body.sellthruNota, MITRA_DETAIL_FIELD_GROUPS[1].fields.map((field) => field.key)),
        rechargeDigiposJson: sanitizeDetailGroup(body.rechargeDigipos, MITRA_DETAIL_FIELD_GROUPS[2].fields.map((field) => field.key)),
    });

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "CREATE",
        entity: "mitra_outlet",
        entityId: id,
        diff: { outletCode: body.outletCode, name: body.name },
        ip: getClientIp(request),
    });

    const [created] = await db.select().from(mitraOutlets).where(eq(mitraOutlets.id, id));
    return NextResponse.json(created, { status: 201 });
}
