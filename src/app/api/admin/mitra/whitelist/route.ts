import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOutlets, mitraTerritories, mitraWhitelistNumbers } from "@/db/schema";
import { requireMitraAccess, writeMitraAuditLog } from "@/lib/mitra-auth";
import { getClientIp, normalizePhoneE164 } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireMitraAccess(["MANAGER"]);
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
    const auth = await requireMitraAccess(["MANAGER"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const phoneE164 = normalizePhoneE164(String(body.phoneE164 || body.phone || ""));
    const scope = body.scope || "ALL";

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

    await writeMitraAuditLog({
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
