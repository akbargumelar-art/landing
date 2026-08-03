import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { indihomeLocations, indihomeProducts } from "@/db/schema";
import { requireRole } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    try {
        const [existing] = await db.select().from(indihomeLocations).where(eq(indihomeLocations.id, id)).limit(1);
        if (!existing) return NextResponse.json({ error: "Lokasi tidak ditemukan." }, { status: 404 });

        const name = body.name === undefined ? existing.name : String(body.name).trim();
        if (name.length < 3 || name.length > 120) {
            return NextResponse.json({ error: "Nama lokasi minimal 3 karakter." }, { status: 400 });
        }

        const [clash] = await db
            .select({ id: indihomeLocations.id })
            .from(indihomeLocations)
            .where(and(eq(indihomeLocations.name, name), ne(indihomeLocations.id, id)))
            .limit(1);
        if (clash) {
            return NextResponse.json({ error: "Lokasi dengan nama itu sudah ada." }, { status: 400 });
        }

        await db.update(indihomeLocations).set({
            name,
            isActive: body.isActive ?? existing.isActive,
            sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : existing.sortOrder,
        }).where(eq(indihomeLocations.id, id));

        const [updated] = await db.select().from(indihomeLocations).where(eq(indihomeLocations.id, id));
        return NextResponse.json({ location: updated });
    } catch (error) {
        console.error("Indihome location PUT error:", error);
        return NextResponse.json({ error: "Lokasi gagal disimpan." }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;

    try {
        const [existing] = await db.select().from(indihomeLocations).where(eq(indihomeLocations.id, id)).limit(1);
        if (!existing) return NextResponse.json({ error: "Lokasi tidak ditemukan." }, { status: 404 });

        // Product coverage is stored as a JSON array of location names, so a delete would
        // silently orphan those entries. Block it and let the admin deactivate instead.
        const products = await db
            .select({ id: indihomeProducts.id, name: indihomeProducts.name, locations: indihomeProducts.locations })
            .from(indihomeProducts);
        const inUse = products.filter((product) => (product.locations || []).includes(existing.name));
        if (inUse.length > 0) {
            return NextResponse.json({
                error: `Lokasi masih dipakai ${inUse.length} paket (${inUse.map((p) => p.name).join(", ")}). Lepaskan dari paket tersebut atau nonaktifkan lokasi ini.`,
            }, { status: 400 });
        }

        await db.delete(indihomeLocations).where(eq(indihomeLocations.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Indihome location DELETE error:", error);
        return NextResponse.json({ error: "Lokasi gagal dihapus." }, { status: 500 });
    }
}
