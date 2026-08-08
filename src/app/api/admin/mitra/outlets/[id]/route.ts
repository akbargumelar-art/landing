import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutletDetails, mitraOutlets } from "@/db/schema";
import { getUserTerritoryIds, isTerritoryScopedRole, requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
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

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const [outlet] = await db.select().from(mitraOutlets).where(eq(mitraOutlets.id, id)).limit(1);
    if (!outlet) return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 });

    // The list endpoint filters by territory, so this one must too - otherwise a scoped role
    // could read any outlet's sensitive performance detail just by knowing its id.
    if (auth.session && isTerritoryScopedRole(auth.session.role)) {
        const territoryIds = await getUserTerritoryIds(auth.session.userId);
        if (!outlet.territoryId || !territoryIds.includes(outlet.territoryId)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    const [details] = await db.select().from(mitraOutletDetails).where(eq(mitraOutletDetails.outletId, id)).limit(1);
    return NextResponse.json({ outlet, details });
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const [existing] = await db.select().from(mitraOutlets).where(eq(mitraOutlets.id, id)).limit(1);

    if (!existing) return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 });

    // Form admin mengirim salesforceId dari dropdown, sedangkan jalur lain (mis. skrip)
    // masih boleh mengirim namanya saja -- keduanya berakhir di master yang sama.
    const salesforceId = body.salesforceId !== undefined
        ? (body.salesforceId || null)
        : body.salesforce !== undefined
            ? await resolveSalesforceId(body.salesforce)
            : existing.salesforceId;

    const longitude = body.longitude === "" ? null : body.longitude === undefined ? existing.longitude : Number(body.longitude);
    const latitude = body.latitude === "" ? null : body.latitude === undefined ? existing.latitude : Number(body.latitude);

    await db.update(mitraOutlets).set({
        outletCode: body.outletCode ?? existing.outletCode,
        publicToken: body.regenerateToken ? generatePublicToken() : existing.publicToken,
        rsNumber: body.rsNumber ?? existing.rsNumber,
        name: body.name ?? existing.name,
        ownerName: body.ownerName ?? existing.ownerName,
        ownerPhone: body.ownerPhone ? normalizePhoneE164(String(body.ownerPhone)) : existing.ownerPhone,
        tap: body.tap ?? existing.tap,
        salesforceId,
        kabupaten: body.kabupaten ?? existing.kabupaten,
        kecamatan: body.kecamatan ?? existing.kecamatan,
        longitude,
        latitude,
        // Koordinat adalah sumber kebenaran tautan lokasi; nilai lama hanya dipakai
        // selama koordinat masih kosong.
        locationUrl: resolveOutletMapsUrl(latitude, longitude, existing.locationUrl) || null,
        territoryId: body.territoryId === "" ? null : body.territoryId ?? existing.territoryId,
        category: normalizeOutletCategory(body.category ?? existing.category),
        pjpDay: normalizePjpDay(body.pjpDay ?? existing.pjpDay),
        pjpType: normalizePjpType(body.pjpType ?? existing.pjpType),
        branding: normalizeOutletBranding(body.branding ?? existing.branding),
        status: body.status ?? existing.status,
        photoUrl: body.photoUrl === "" ? null : body.photoUrl ?? existing.photoUrl,
    }).where(eq(mitraOutlets.id, id));

    if (body.sellthruDigipos || body.sellthruNota || body.rechargeDigipos) {
        const [details] = await db.select().from(mitraOutletDetails).where(eq(mitraOutletDetails.outletId, id)).limit(1);
        const values = {
            outletId: id,
            sellthruDigiposJson: sanitizeDetailGroup(body.sellthruDigipos, MITRA_DETAIL_FIELD_GROUPS[0].fields.map((field) => field.key)),
            sellthruNotaJson: sanitizeDetailGroup(body.sellthruNota, MITRA_DETAIL_FIELD_GROUPS[1].fields.map((field) => field.key)),
            rechargeDigiposJson: sanitizeDetailGroup(body.rechargeDigipos, MITRA_DETAIL_FIELD_GROUPS[2].fields.map((field) => field.key)),
        };

        if (details) {
            await db.update(mitraOutletDetails).set(values).where(eq(mitraOutletDetails.outletId, id));
        } else {
            await db.insert(mitraOutletDetails).values(values);
        }
    }

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "UPDATE",
        entity: "mitra_outlet",
        entityId: id,
        diff: { outletCode: body.outletCode, name: body.name, status: body.status, regenerateToken: body.regenerateToken },
        ip: getClientIp(request),
    });

    const [updated] = await db.select().from(mitraOutlets).where(eq(mitraOutlets.id, id)).limit(1);
    return NextResponse.json(updated);
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const [existing] = await db.select().from(mitraOutlets).where(eq(mitraOutlets.id, id)).limit(1);

    if (!existing) {
        return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 });
    }

    // Detail, metrics, program participation, and OTP rows all cascade from mitra_outlets.
    await db.delete(mitraOutlets).where(eq(mitraOutlets.id, id));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "DELETE",
        entity: "mitra_outlet",
        entityId: id,
        diff: { outletCode: existing.outletCode, name: existing.name },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
