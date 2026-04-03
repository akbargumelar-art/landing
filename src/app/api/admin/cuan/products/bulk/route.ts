import { NextResponse } from "next/server";
import { db } from "@/db";
import { cuanProducts } from "@/db/schema";
import { inArray } from "drizzle-orm";

export async function DELETE(req: Request) {
    try {
        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "Pilih minimal 1 produk" }, { status: 400 });
        }
        await db.delete(cuanProducts).where(inArray(cuanProducts.id, ids));
        return NextResponse.json({ deleted: ids.length });
    } catch {
        return NextResponse.json({ error: "Gagal hapus produk" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { ids, data } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "Pilih minimal 1 produk" }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (data.categoryId) updateData.categoryId = data.categoryId;
        if (data.brandId) updateData.brandId = data.brandId;
        if (data.capitalPrice !== undefined && data.capitalPrice !== "") updateData.capitalPrice = String(data.capitalPrice);
        if (data.sellingPrice !== undefined && data.sellingPrice !== "") updateData.sellingPrice = String(data.sellingPrice);
        if (data.cashback !== undefined && data.cashback !== "") updateData.cashback = String(data.cashback);
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.isHot !== undefined) updateData.isHot = data.isHot;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "Tidak ada data yang diubah" }, { status: 400 });
        }

        await db.update(cuanProducts).set(updateData).where(inArray(cuanProducts.id, ids));
        return NextResponse.json({ updated: ids.length });
    } catch {
        return NextResponse.json({ error: "Gagal update produk" }, { status: 500 });
    }
}
