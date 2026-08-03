import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { indihomeBanners } from "@/db/schema";
import { requireRole } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function parseBannerInput(body: Record<string, unknown>) {
    const imageUrl = String(body.imageUrl || "").trim();
    if (!imageUrl) return { error: "Gambar banner wajib diunggah." } as const;

    return {
        values: {
            imageUrl,
            headline: String(body.headline || "").trim().slice(0, 255),
            subheadline: String(body.subheadline || "").trim().slice(0, 500),
            ctaText: String(body.ctaText || "").trim().slice(0, 255),
            ctaLink: String(body.ctaLink || "").trim().slice(0, 500),
            isActive: body.isActive !== false,
            sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        },
    } as const;
}

export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER"]);
    if (auth.error) return auth.error;

    try {
        const banners = await db
            .select()
            .from(indihomeBanners)
            .orderBy(asc(indihomeBanners.sortOrder), asc(indihomeBanners.createdAt));
        return NextResponse.json({ banners });
    } catch (error) {
        console.error("Indihome banner GET error:", error);
        return NextResponse.json({ error: "Banner gagal dimuat." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const parsed = parseBannerInput(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    try {
        const id = uuid();
        await db.insert(indihomeBanners).values({ id, ...parsed.values, createdAt: new Date() });
        const [created] = await db.select().from(indihomeBanners).where(eq(indihomeBanners.id, id));
        return NextResponse.json({ banner: created }, { status: 201 });
    } catch (error) {
        console.error("Indihome banner POST error:", error);
        return NextResponse.json({ error: "Banner gagal disimpan." }, { status: 500 });
    }
}
