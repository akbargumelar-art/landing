import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
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
        // Paket bertanda terpopuler selalu di urutan awal; sortOrder tetap menentukan
        // urutan di dalam masing-masing kelompok, jadi penataan manual admin tidak hilang.
        const products = await db
            .select()
            .from(indihomeProducts)
            .where(eq(indihomeProducts.isActive, true))
            .orderBy(desc(indihomeProducts.isFeatured), asc(indihomeProducts.sortOrder), asc(indihomeProducts.speedMbps));

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
        // Katalog cadangan diurutkan dengan aturan yang sama supaya tampilannya tidak
        // berubah hanya karena datanya sedang diambil dari konstanta, bukan database.
        products: [...INDIHOME_PRODUCTS].sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false)),
        locations: locations.length > 0 ? locations : [...INDIHOME_LOCATIONS],
        source: "fallback",
    });
}
