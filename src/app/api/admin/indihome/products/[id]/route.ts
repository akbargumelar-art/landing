import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { indihomeProducts } from "@/db/schema";
import { parseIndihomeProductInput } from "@/lib/indihome-admin";
import { requireRole } from "@/lib/admin-auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = parseIndihomeProductInput(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    try {
        await db.update(indihomeProducts).set(parsed.values).where(eq(indihomeProducts.id, id));
        const [product] = await db.select().from(indihomeProducts).where(eq(indihomeProducts.id, id));
        if (!product) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
        return NextResponse.json({ product });
    } catch (error) {
        console.error("Indihome product PUT error:", error);
        return NextResponse.json({ error: "Produk gagal disimpan." }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    try {
        await db.delete(indihomeProducts).where(eq(indihomeProducts.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Indihome product DELETE error:", error);
        return NextResponse.json({ error: "Produk gagal dihapus." }, { status: 500 });
    }
}
