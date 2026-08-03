import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { indihomeProducts } from "@/db/schema";
import { INDIHOME_LOCATIONS, INDIHOME_PRODUCTS } from "@/lib/indihome-products";
import { getActiveIndihomeLocations } from "@/lib/indihome-data";

export const dynamic = "force-dynamic";

export async function GET() {
    // Locations ship alongside the catalog so the public page needs a single round trip.
    // getActiveIndihomeLocations already falls back to the constants on its own.
    const locations = await getActiveIndihomeLocations();

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
                locations,
                source: "database",
            });
        }
    } catch {
        // Keep the public catalog usable while a new deployment is waiting for migration.
    }

    return NextResponse.json({
        products: INDIHOME_PRODUCTS,
        locations: locations.length > 0 ? locations : [...INDIHOME_LOCATIONS],
        source: "fallback",
    });
}
