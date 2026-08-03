import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { indihomeBanners, indihomeLocations } from "@/db/schema";
import { INDIHOME_LOCATIONS } from "@/lib/indihome-products";

export interface IndihomeBannerView {
    imageUrl: string;
    headline: string;
    subheadline: string;
    ctaText: string;
    ctaLink: string;
}

/**
 * Fallback used when the database is unreachable or has not been migrated yet, mirroring
 * the pattern the IndiHome product catalog already uses. Keeping a fallback means an
 * outage degrades the page instead of emptying the location dropdown (which would also
 * block every submission, since the same list gates server-side validation).
 */
export const FALLBACK_BANNER: IndihomeBannerView = {
    imageUrl: "/indihome/hero-family.png",
    headline: "Internet rumah untuk semua aktivitas keluarga",
    subheadline: "Temukan pilihan kecepatan berdasarkan lokasi Anda, lalu ajukan pemasangan dalam beberapa langkah.",
    ctaText: "Lihat paket tersedia",
    ctaLink: "#paket",
};

export async function getActiveIndihomeLocations(): Promise<string[]> {
    try {
        const rows = await db
            .select({ name: indihomeLocations.name })
            .from(indihomeLocations)
            .where(eq(indihomeLocations.isActive, true))
            .orderBy(asc(indihomeLocations.sortOrder), asc(indihomeLocations.name));

        if (rows.length > 0) return rows.map((row) => row.name);
    } catch (error) {
        console.error("Indihome locations lookup failed, falling back to constants:", error);
    }
    return [...INDIHOME_LOCATIONS];
}

/**
 * Validates a submitted location against the live list rather than the old constant, so a
 * location added from the admin is accepted immediately without a deploy.
 */
export async function isActiveIndihomeLocation(value: string): Promise<boolean> {
    const locations = await getActiveIndihomeLocations();
    return locations.includes(value);
}

export async function getActiveIndihomeBanner(): Promise<IndihomeBannerView> {
    try {
        const [row] = await db
            .select()
            .from(indihomeBanners)
            .where(eq(indihomeBanners.isActive, true))
            .orderBy(asc(indihomeBanners.sortOrder), asc(indihomeBanners.createdAt))
            .limit(1);

        if (row) {
            return {
                imageUrl: row.imageUrl || FALLBACK_BANNER.imageUrl,
                headline: row.headline || FALLBACK_BANNER.headline,
                subheadline: row.subheadline || FALLBACK_BANNER.subheadline,
                ctaText: row.ctaText || FALLBACK_BANNER.ctaText,
                ctaLink: row.ctaLink || FALLBACK_BANNER.ctaLink,
            };
        }
    } catch (error) {
        console.error("Indihome banner lookup failed, falling back to static hero:", error);
    }
    return FALLBACK_BANNER;
}
