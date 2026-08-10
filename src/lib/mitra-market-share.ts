/**
 * Daftar operator untuk market share kecamatan. Urutannya dipakai apa adanya di form
 * admin maupun tampilan publik, dan key-nya sama persis dengan nama kolom di
 * mitra_market_shares -- jadi satu daftar ini yang menentukan keduanya.
 */
export const MITRA_MARKET_SHARE_OPERATORS = [
    { key: "telkomsel", label: "Telkomsel", color: "#dc2626" },
    { key: "xl", label: "XL", color: "#2563eb" },
    { key: "smartfren", label: "Smartfren", color: "#ea580c" },
    { key: "indosat", label: "Indosat", color: "#ca8a04" },
    { key: "tri", label: "Tri", color: "#0f766e" },
] as const;

export type MitraMarketShareKey = (typeof MITRA_MARKET_SHARE_OPERATORS)[number]["key"];

/** Persentase dibatasi 0-100 dan disimpan sebagai decimal(5,2). */
export function normalizeSharePercent(input: unknown): string {
    const raw = typeof input === "number" ? input : Number(String(input ?? "").replace(",", "."));
    if (!Number.isFinite(raw)) return "0.00";
    return Math.min(Math.max(raw, 0), 100).toFixed(2);
}

export function sumShares(values: Partial<Record<MitraMarketShareKey, string | number>>): number {
    return MITRA_MARKET_SHARE_OPERATORS.reduce((total, operator) => total + Number(values[operator.key] ?? 0), 0);
}

/**
 * Peta ke tiga entitas pasca-merger: XL + Smartfren jadi XL Smart, Indosat + Tri jadi
 * IOH. Angka mentah per operator tetap yang disimpan -- pengelompokan ini cuma cara
 * lain menyajikannya, bukan kolom baru, supaya data lama tidak perlu dimigrasi.
 */
export const MITRA_MARKET_SHARE_MERGED_GROUPS = [
    { key: "telkomsel", label: "Telkomsel", color: "#dc2626", sumber: ["telkomsel"] as MitraMarketShareKey[] },
    { key: "xlsmart", label: "XL Smart", color: "#2563eb", sumber: ["xl", "smartfren"] as MitraMarketShareKey[] },
    { key: "ioh", label: "IOH", color: "#ca8a04", sumber: ["indosat", "tri"] as MitraMarketShareKey[] },
] as const;

export type MitraMarketShareMergedKey = (typeof MITRA_MARKET_SHARE_MERGED_GROUPS)[number]["key"];
