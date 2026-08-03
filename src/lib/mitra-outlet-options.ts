/**
 * Pilihan tetap untuk field master outlet. Dipakai bersama oleh schema (enum kolom),
 * validasi API, form admin, dan importer supaya ketiganya tidak pernah berbeda.
 */

export const OUTLET_CATEGORIES = ["FISIK", "Non FISIK"] as const;
export type OutletCategory = (typeof OUTLET_CATEGORIES)[number];

export const PJP_DAYS = [
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
    "Minggu",
] as const;
export type PjpDay = (typeof PJP_DAYS)[number];

/** F1..F8 menyatakan berapa kali outlet wajib dikunjungi salesforce dalam sebulan. */
export const PJP_TYPES = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"] as const;
export type PjpType = (typeof PJP_TYPES)[number];

export const OUTLET_BRANDINGS = [
    "Non Branding",
    "Telkomsel",
    "byU",
    "XL",
    "Axis",
    "Smartfren",
    "Indosat",
    "Tri",
    "BRILINK",
    "Lainnya",
] as const;
export type OutletBranding = (typeof OUTLET_BRANDINGS)[number];

export const DEFAULT_OUTLET_CATEGORY: OutletCategory = "FISIK";
export const DEFAULT_PJP_DAY: PjpDay = "Senin";
export const DEFAULT_PJP_TYPE: PjpType = "F1";
export const DEFAULT_OUTLET_BRANDING: OutletBranding = "Non Branding";

function matchOption<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
    const raw = String(value ?? "").trim();
    if (!raw) return fallback;
    const hit = options.find((option) => option.toLowerCase() === raw.toLowerCase());
    return hit ?? fallback;
}

/**
 * Normalisasi nilai bebas (mis. dari import Excel) ke salah satu pilihan yang sah.
 * Nilai yang tidak dikenal jatuh ke default, bukan ditolak, supaya satu sel keliru
 * tidak menggagalkan seluruh baris import.
 */
export function normalizeOutletCategory(value: unknown): OutletCategory {
    const raw = String(value ?? "").trim().toLowerCase();
    if (raw === "non fisik" || raw === "nonfisik" || raw === "non-fisik") return "Non FISIK";
    return matchOption(OUTLET_CATEGORIES, value, DEFAULT_OUTLET_CATEGORY);
}

export function normalizePjpDay(value: unknown): PjpDay {
    return matchOption(PJP_DAYS, value, DEFAULT_PJP_DAY);
}

export function normalizePjpType(value: unknown): PjpType {
    return matchOption(PJP_TYPES, String(value ?? "").trim().toUpperCase(), DEFAULT_PJP_TYPE);
}

export function normalizeOutletBranding(value: unknown): OutletBranding {
    const raw = String(value ?? "").trim();
    // Kosong berarti memang tidak ada branding. Merek yang tidak dikenal bukan berarti
    // tanpa branding, jadi diarahkan ke "Lainnya" - sama dengan pemetaan di migrasi 0007.
    if (!raw) return DEFAULT_OUTLET_BRANDING;
    if (raw === "3") return "Tri";
    if (raw.toLowerCase() === "bri link") return "BRILINK";
    return matchOption(OUTLET_BRANDINGS, raw, "Lainnya");
}

/**
 * URL Google Maps dibangun dari koordinat, bukan diketik manual, supaya tautan lokasi
 * selalu konsisten dengan longitude/latitude yang tersimpan.
 */
export function buildOutletMapsUrl(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
): string {
    if (typeof latitude !== "number" || typeof longitude !== "number") return "";
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return "";
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Koordinat adalah sumber kebenaran; nilai manual lama hanya dipakai bila koordinat kosong. */
export function resolveOutletMapsUrl(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
    storedUrl?: string | null,
): string {
    return buildOutletMapsUrl(latitude, longitude) || (storedUrl || "");
}
