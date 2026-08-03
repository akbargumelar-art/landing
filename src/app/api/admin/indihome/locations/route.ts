import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { indihomeLocations } from "@/db/schema";
import { requireRole } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER"]);
    if (auth.error) return auth.error;

    try {
        const locations = await db
            .select()
            .from(indihomeLocations)
            .orderBy(asc(indihomeLocations.sortOrder), asc(indihomeLocations.name));
        return NextResponse.json({ locations });
    } catch (error) {
        console.error("Indihome locations GET error:", error);
        return NextResponse.json({ error: "Lokasi gagal dimuat." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();

    if (name.length < 3 || name.length > 120) {
        return NextResponse.json({ error: "Nama lokasi minimal 3 karakter." }, { status: 400 });
    }

    try {
        const [existing] = await db
            .select()
            .from(indihomeLocations)
            .where(eq(indihomeLocations.name, name))
            .limit(1);
        if (existing) {
            return NextResponse.json({ error: "Lokasi dengan nama itu sudah ada." }, { status: 400 });
        }

        const id = uuid();
        await db.insert(indihomeLocations).values({
            id,
            name,
            isActive: body.isActive !== false,
            sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
            createdAt: new Date(),
        });
        const [created] = await db.select().from(indihomeLocations).where(eq(indihomeLocations.id, id));
        return NextResponse.json({ location: created }, { status: 201 });
    } catch (error) {
        console.error("Indihome locations POST error:", error);
        return NextResponse.json({ error: "Lokasi gagal disimpan." }, { status: 500 });
    }
}
