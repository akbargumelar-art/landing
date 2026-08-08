import { NextResponse } from "next/server";
import { and, asc, eq, like, or, type SQL } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraMarketShares, mitraOutlets } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/mitra-utils";
import { MITRA_MARKET_SHARE_OPERATORS, normalizeSharePercent } from "@/lib/mitra-market-share";

export const dynamic = "force-dynamic";

function readShares(body: Record<string, unknown>) {
    return Object.fromEntries(
        MITRA_MARKET_SHARE_OPERATORS.map((operator) => [operator.key, normalizeSharePercent(body[operator.key])])
    ) as Record<(typeof MITRA_MARKET_SHARE_OPERATORS)[number]["key"], string>;
}

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const q = (new URL(request.url).searchParams.get("q") || "").trim();
    const where: SQL | undefined = q
        ? or(like(mitraMarketShares.kabupaten, `%${q}%`), like(mitraMarketShares.kecamatan, `%${q}%`))
        : undefined;

    // Wilayah yang benar-benar dipakai outlet ikut dikirim untuk mengisi datalist di form.
    // Pencocokan market share ke outlet dilakukan pada teks persis, jadi salah ketik satu
    // huruf saja membuat datanya tidak pernah tampil -- datalist ini yang mencegahnya.
    const [rows, areaRows] = await Promise.all([
        db
            .select()
            .from(mitraMarketShares)
            .where(where)
            .orderBy(asc(mitraMarketShares.kabupaten), asc(mitraMarketShares.kecamatan))
            .limit(500),
        db
            .selectDistinct({ kabupaten: mitraOutlets.kabupaten, kecamatan: mitraOutlets.kecamatan })
            .from(mitraOutlets),
    ]);

    return NextResponse.json({
        marketShares: rows,
        areas: areaRows.filter((row) => row.kabupaten && row.kecamatan),
    });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const kabupaten = String(body.kabupaten || "").trim();
    const kecamatan = String(body.kecamatan || "").trim();

    if (!kabupaten || !kecamatan) {
        return NextResponse.json({ error: "Kabupaten dan kecamatan wajib diisi" }, { status: 400 });
    }

    const shares = readShares(body);
    const now = new Date();

    // Upsert: mengunggah ulang wilayah yang sama memperbarui angkanya, bukan menolak.
    await db
        .insert(mitraMarketShares)
        .values({ id: uuid(), kabupaten, kecamatan, ...shares, createdAt: now })
        .onDuplicateKeyUpdate({ set: shares });

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "UPSERT",
        entity: "mitra_market_share",
        entityId: `${kabupaten}/${kecamatan}`,
        diff: shares,
        ip: getClientIp(request),
    });

    const [saved] = await db
        .select()
        .from(mitraMarketShares)
        .where(and(eq(mitraMarketShares.kabupaten, kabupaten), eq(mitraMarketShares.kecamatan, kecamatan)))
        .limit(1);

    return NextResponse.json(saved);
}

export async function PUT(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    const [existing] = await db.select().from(mitraMarketShares).where(eq(mitraMarketShares.id, id)).limit(1);

    if (!existing) return NextResponse.json({ error: "Data market share tidak ditemukan" }, { status: 404 });

    const kabupaten = body.kabupaten === undefined ? existing.kabupaten : String(body.kabupaten).trim();
    const kecamatan = body.kecamatan === undefined ? existing.kecamatan : String(body.kecamatan).trim();

    if (!kabupaten || !kecamatan) {
        return NextResponse.json({ error: "Kabupaten dan kecamatan wajib diisi" }, { status: 400 });
    }

    await db
        .update(mitraMarketShares)
        .set({ kabupaten, kecamatan, ...readShares(body) })
        .where(eq(mitraMarketShares.id, id));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "UPDATE",
        entity: "mitra_market_share",
        entityId: id,
        diff: { kabupaten, kecamatan },
        ip: getClientIp(request),
    });

    const [updated] = await db.select().from(mitraMarketShares).where(eq(mitraMarketShares.id, id)).limit(1);
    return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const id = new URL(request.url).searchParams.get("id") || "";
    const [existing] = await db.select().from(mitraMarketShares).where(eq(mitraMarketShares.id, id)).limit(1);

    if (!existing) return NextResponse.json({ error: "Data market share tidak ditemukan" }, { status: 404 });

    await db.delete(mitraMarketShares).where(eq(mitraMarketShares.id, id));

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "DELETE",
        entity: "mitra_market_share",
        entityId: id,
        diff: { kabupaten: existing.kabupaten, kecamatan: existing.kecamatan },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
