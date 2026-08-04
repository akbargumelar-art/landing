import { NextResponse } from "next/server";
import { db } from "@/db";
import { heroSlides } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/admin-auth";

// PUT update hero slide
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    try {
        const { id } = await params;
        const body = await request.json();

        await db
            .update(heroSlides)
            .set({
                title: body.title,
                subtitle: body.subtitle,
                ctaText: body.ctaText,
                ctaLink: body.ctaLink,
                imageUrl: body.imageUrl,
                bgColor: body.bgColor,
                isActive: body.isActive,
            })
            .where(eq(heroSlides.id, id));

        const [slide] = await db.select().from(heroSlides).where(eq(heroSlides.id, id));
        return NextResponse.json(slide);
    } catch (error) {
        console.error("Hero slide PUT error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE hero slide
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    try {
        const { id } = await params;
        await db.delete(heroSlides).where(eq(heroSlides.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Hero slide DELETE error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
