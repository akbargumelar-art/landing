import { NextResponse } from "next/server";
import { db } from "@/db";
import { cuanCategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/admin-auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    try {
        const { id } = await params;
        const { name } = await req.json();
        if (!name) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });

        await db.update(cuanCategories).set({ name }).where(eq(cuanCategories.id, id));
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Gagal update kategori" }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    try {
        const { id } = await params;
        await db.delete(cuanCategories).where(eq(cuanCategories.id, id));
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Gagal hapus kategori. Pastikan tidak ada produk yang menggunakan kategori ini." }, { status: 500 });
    }
}
