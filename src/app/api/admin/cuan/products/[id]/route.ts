import { NextResponse } from "next/server";
import { db } from "@/db";
import { cuanProducts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/admin-auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    try {
        const { id } = await params;
        const body = await req.json();
        const { name, categoryId, brandId, capitalPrice, sellingPrice, cashback, isActive, isHot } = body;

        await db.update(cuanProducts).set({
            ...(name !== undefined && { name }),
            ...(categoryId !== undefined && { categoryId }),
            ...(brandId !== undefined && { brandId }),
            ...(capitalPrice !== undefined && { capitalPrice: String(capitalPrice) }),
            ...(sellingPrice !== undefined && { sellingPrice: String(sellingPrice) }),
            ...(cashback !== undefined && { cashback: String(cashback) }),
            ...(isActive !== undefined && { isActive }),
            ...(isHot !== undefined && { isHot }),
        }).where(eq(cuanProducts.id, id));

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Gagal update produk" }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    try {
        const { id } = await params;
        await db.delete(cuanProducts).where(eq(cuanProducts.id, id));
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Gagal hapus produk" }, { status: 500 });
    }
}
