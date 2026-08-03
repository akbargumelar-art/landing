import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { indihomeBanners } from "@/db/schema";
import { requireRole } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    try {
        const [existing] = await db.select().from(indihomeBanners).where(eq(indihomeBanners.id, id)).limit(1);
        if (!existing) return NextResponse.json({ error: "Banner tidak ditemukan." }, { status: 404 });

        const imageUrl = body.imageUrl === undefined ? existing.imageUrl : String(body.imageUrl).trim();
        if (!imageUrl) return NextResponse.json({ error: "Gambar banner wajib diisi." }, { status: 400 });

        await db.update(indihomeBanners).set({
            imageUrl,
            headline: body.headline === undefined ? existing.headline : String(body.headline).trim().slice(0, 255),
            subheadline: body.subheadline === undefined ? existing.subheadline : String(body.subheadline).trim().slice(0, 500),
            ctaText: body.ctaText === undefined ? existing.ctaText : String(body.ctaText).trim().slice(0, 255),
            ctaLink: body.ctaLink === undefined ? existing.ctaLink : String(body.ctaLink).trim().slice(0, 500),
            isActive: body.isActive ?? existing.isActive,
            sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : existing.sortOrder,
        }).where(eq(indihomeBanners.id, id));

        const [updated] = await db.select().from(indihomeBanners).where(eq(indihomeBanners.id, id));
        return NextResponse.json({ banner: updated });
    } catch (error) {
        console.error("Indihome banner PUT error:", error);
        return NextResponse.json({ error: "Banner gagal disimpan." }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    try {
        await db.delete(indihomeBanners).where(eq(indihomeBanners.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Indihome banner DELETE error:", error);
        return NextResponse.json({ error: "Banner gagal dihapus." }, { status: 500 });
    }
}
