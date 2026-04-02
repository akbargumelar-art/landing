import { NextResponse } from "next/server";
import { db } from "@/db";
import { cuanProducts, cuanCategories, cuanBrands } from "@/db/schema";
import { eq } from "drizzle-orm";

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
            })
            .from(cuanProducts)
            .leftJoin(cuanCategories, eq(cuanProducts.categoryId, cuanCategories.id))
            .leftJoin(cuanBrands, eq(cuanProducts.brandId, cuanBrands.id))
            .where(eq(cuanProducts.isActive, true))
            .orderBy(cuanProducts.name);

        return NextResponse.json(rows);
    } catch {
        return NextResponse.json([], { status: 500 });
    }
}
