import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutletDetails, mitraOutlets } from "@/db/schema";
import { requireMitraAccess, writeMitraAuditLog } from "@/lib/mitra-auth";
import { MITRA_DETAIL_FIELD_GROUPS, sanitizeDetailGroup } from "@/lib/mitra-fields";
import { generatePublicToken, getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireMitraAccess();
    if (auth.error) return auth.error;

    const { id } = await params;
    const [outlet] = await db.select().from(mitraOutlets).where(eq(mitraOutlets.id, id)).limit(1);
    if (!outlet) return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 });

    const [details] = await db.select().from(mitraOutletDetails).where(eq(mitraOutletDetails.outletId, id)).limit(1);
    return NextResponse.json({ outlet, details });
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireMitraAccess(["MANAGER", "ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const [existing] = await db.select().from(mitraOutlets).where(eq(mitraOutlets.id, id)).limit(1);

    if (!existing) return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 });

    await db.update(mitraOutlets).set({
        outletCode: body.outletCode ?? existing.outletCode,
        publicToken: body.regenerateToken ? generatePublicToken() : existing.publicToken,
        rsNumber: body.rsNumber ?? existing.rsNumber,
        name: body.name ?? existing.name,
        ownerName: body.ownerName ?? existing.ownerName,
        ownerPhone: body.ownerPhone ? normalizePhoneE164(String(body.ownerPhone)) : existing.ownerPhone,
        tap: body.tap ?? existing.tap,
        salesforce: body.salesforce ?? existing.salesforce,
        kabupaten: body.kabupaten ?? existing.kabupaten,
        kecamatan: body.kecamatan ?? existing.kecamatan,
        longitude: body.longitude === "" ? null : body.longitude === undefined ? existing.longitude : Number(body.longitude),
        latitude: body.latitude === "" ? null : body.latitude === undefined ? existing.latitude : Number(body.latitude),
        locationUrl: body.locationUrl === "" ? null : body.locationUrl ?? existing.locationUrl,
        territoryId: body.territoryId === "" ? null : body.territoryId ?? existing.territoryId,
        category: body.category ?? existing.category,
        pjpDay: body.pjpDay ?? existing.pjpDay,
        pjpType: body.pjpType ?? existing.pjpType,
        branding: body.branding ?? existing.branding,
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

    await writeMitraAuditLog({
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
