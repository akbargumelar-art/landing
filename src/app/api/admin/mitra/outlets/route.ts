import { NextResponse } from "next/server";
import { and, asc, count, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOutletDetails, mitraOutlets, mitraSalesforces } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getAdminActorScope, outletScopeCondition } from "@/lib/admin-scope";
import { MITRA_DETAIL_FIELD_GROUPS, sanitizeDetailGroup } from "@/lib/mitra-fields";
import { generatePublicToken, getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";
import { resolveSalesforceId } from "@/lib/mitra-salesforce";
import {
    normalizeOutletBranding,
    normalizeOutletCategory,
    normalizePjpDay,
    normalizePjpType,
    resolveOutletMapsUrl,
} from "@/lib/mitra-outlet-options";

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

    /**
     * Pembatasan wewenang masuk ke KONDISI QUERY, bukan menyaring hasil setelahnya: nilai
     * `total` dihitung dari where yang sama, jadi menyaring belakangan akan membocorkan
     * cacah outlet di luar wewenang lewat angka totalnya sendiri.
     *
     * Sebelumnya pembatasan hanya memakai TAP, sehingga seorang salesforce ikut melihat --
     * dan lewat endpoint detail, membaca -- seluruh outlet binaan rekan setimnya.
     */
    const scope = await getAdminActorScope();
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const kondisiScope = outletScopeCondition(scope);
    if (kondisiScope) filters.push(kondisiScope);

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
            salesforceId: mitraOutlets.salesforceId,
            salesforce: mitraSalesforces.name,
            salesforcePhotoUrl: mitraSalesforces.photoUrl,
            kabupaten: mitraOutlets.kabupaten,
            kecamatan: mitraOutlets.kecamatan,
            longitude: mitraOutlets.longitude,
            latitude: mitraOutlets.latitude,
            locationUrl: mitraOutlets.locationUrl,
            category: mitraOutlets.category,
            pjpDay: mitraOutlets.pjpDay,
            pjpType: mitraOutlets.pjpType,
            branding: mitraOutlets.branding,
            status: mitraOutlets.status,
            photoUrl: mitraOutlets.photoUrl,
            createdAt: mitraOutlets.createdAt,
        })
        .from(mitraOutlets)
        .leftJoin(mitraSalesforces, eq(mitraOutlets.salesforceId, mitraSalesforces.id))
        .where(where)
        .orderBy(desc(mitraOutlets.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

    // Dipakai dropdown salesforce di editor outlet; hanya yang aktif yang bisa dipilih,
    // tetapi outlet yang terlanjur menaut ke yang nonaktif tetap ditampilkan apa adanya.
    const salesforces = await db
        .select({ id: mitraSalesforces.id, name: mitraSalesforces.name, isActive: mitraSalesforces.isActive })
        .from(mitraSalesforces)
        .orderBy(asc(mitraSalesforces.name));

    return NextResponse.json({
        outlets,
        salesforces,
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

    const longitude = body.longitude === "" || body.longitude === undefined ? null : Number(body.longitude);
    const latitude = body.latitude === "" || body.latitude === undefined ? null : Number(body.latitude);

    await db.insert(mitraOutlets).values({
        id,
        outletCode: String(body.outletCode).trim(),
        publicToken: generatePublicToken(),
        rsNumber: String(body.rsNumber || ""),
        name: String(body.name || "").trim(),
        ownerName: String(body.ownerName || ""),
        ownerPhone: normalizePhoneE164(String(body.ownerPhone || "")),
        tap: String(body.tap || ""),
        salesforceId: body.salesforceId || await resolveSalesforceId(body.salesforce),
        kabupaten: String(body.kabupaten || ""),
        kecamatan: String(body.kecamatan || ""),
        longitude,
        latitude,
        // Tautan lokasi diturunkan dari koordinat, bukan diketik admin.
        locationUrl: resolveOutletMapsUrl(latitude, longitude, body.locationUrl) || null,
        category: normalizeOutletCategory(body.category),
        pjpDay: normalizePjpDay(body.pjpDay),
        pjpType: normalizePjpType(body.pjpType),
        branding: normalizeOutletBranding(body.branding),
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

export async function DELETE(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(String).filter(Boolean) : [];

    if (ids.length === 0) {
        return NextResponse.json({ error: "Pilih minimal satu outlet" }, { status: 400 });
    }

    // Detail, metrics, program participation, and OTP rows all cascade from mitra_outlets.
    const targets = await db
        .select({ id: mitraOutlets.id, outletCode: mitraOutlets.outletCode })
        .from(mitraOutlets)
        .where(inArray(mitraOutlets.id, ids));

    if (targets.length === 0) {
        return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 });
    }

    await db.delete(mitraOutlets).where(inArray(mitraOutlets.id, targets.map((row) => row.id)));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "DELETE_BULK",
        entity: "mitra_outlet",
        diff: { count: targets.length, outletCodes: targets.map((row) => row.outletCode) },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, deleted: targets.length });
}
