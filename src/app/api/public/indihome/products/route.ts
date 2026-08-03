import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { indihomeProducts } from "@/db/schema";
import { INDIHOME_PRODUCTS } from "@/lib/indihome-products";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const products = await db
            .select()
            .from(indihomeProducts)
            .where(eq(indihomeProducts.isActive, true))
            .orderBy(asc(indihomeProducts.sortOrder), asc(indihomeProducts.speedMbps));

        if (products.length > 0) {
            return NextResponse.json({
                products: products.map((product) => ({
                    id: product.id,
                    name: product.name,
                    speedMbps: product.speedMbps,
                    monthlyPrice: Number(product.monthlyPrice),
                    description: product.description,
                    features: product.features,
                    locations: product.locations,
                    featured: product.isFeatured,
                })),
                source: "database",
            });
        }
    } catch {
        // Keep the public catalog usable while a new deployment is waiting for migration.
    }

    return NextResponse.json({ products: INDIHOME_PRODUCTS, source: "fallback" });
}
