import { NextResponse } from "next/server";
import { db } from "@/db";
import { shopBanners, shopSections, products } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
    try {
        const [banners, sections, allProducts] = await Promise.all([
            db.select().from(shopBanners).where(eq(shopBanners.isActive, true)).orderBy(asc(shopBanners.sortOrder)),
            db.select().from(shopSections).where(eq(shopSections.isActive, true)).orderBy(asc(shopSections.sortOrder)),
            db.select().from(products).where(eq(products.isActive, true)),
        ]);
        return NextResponse.json({ banners, sections, products: allProducts });
    } catch (error) {
        console.error("Public shop GET error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
