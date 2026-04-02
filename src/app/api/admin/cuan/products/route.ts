import { NextResponse } from "next/server";
import { db } from "@/db";
import { cuanProducts, cuanCategories, cuanBrands } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function GET() {
    try {
        const rows = await db
            .select({
                id: cuanProducts.id,
                name: cuanProducts.name,
                categoryId: cuanProducts.categoryId,
                categoryName: cuanCategories.name,
                brandId: cuanProducts.brandId,
                brandName: cuanBrands.name,
                capitalPrice: cuanProducts.capitalPrice,
                sellingPrice: cuanProducts.sellingPrice,
                cashback: cuanProducts.cashback,
                isActive: cuanProducts.isActive,
                isHot: cuanProducts.isHot,
                createdAt: cuanProducts.createdAt,
            })
            .from(cuanProducts)
            .leftJoin(cuanCategories, eq(cuanProducts.categoryId, cuanCategories.id))
            .leftJoin(cuanBrands, eq(cuanProducts.brandId, cuanBrands.id))
            .orderBy(cuanProducts.name);

        return NextResponse.json(rows);
    } catch {
        return NextResponse.json([], { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, categoryId, brandId, capitalPrice, sellingPrice, cashback, isHot } = body;

        if (!name || !categoryId || !brandId) {
            return NextResponse.json({ error: "Nama, Kategori, dan Brand wajib diisi" }, { status: 400 });
        }

        const id = uuid();
        await db.insert(cuanProducts).values({
            id,
            name,
            categoryId,
            brandId,
            capitalPrice: String(capitalPrice || 0),
            sellingPrice: String(sellingPrice || 0),
            cashback: String(cashback || 0),
            isActive: true,
            isHot: isHot || false,
            createdAt: new Date(),
        });

        return NextResponse.json({ id, name });
    } catch {
        return NextResponse.json({ error: "Gagal menambah produk" }, { status: 500 });
    }
}
