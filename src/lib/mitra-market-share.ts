const OPERATOR = {
    telkomsel: { key: "telkomsel", label: "Telkomsel", color: "#dc2626", uploadKey: "telkomsel", uploadAliases: [] },
    xl: { key: "xl", label: "XL", color: "#2563eb", uploadKey: "xl", uploadAliases: [] },
    smartfren: { key: "smartfren", label: "Smartfren", color: "#ea580c", uploadKey: "smartfren", uploadAliases: [] },
    indosat: { key: "indosat", label: "Indosat", color: "#ca8a04", uploadKey: "indosat", uploadAliases: [] },
    tri: { key: "tri", label: "Tri", color: "#0f766e", uploadKey: "tri", uploadAliases: [] },
    telkomselAfter: {
        key: "telkomselAfter",
        label: "Telkomsel",
        color: "#dc2626",
        uploadKey: "telkomsel_setelah_merger",
        uploadAliases: ["telkomsel after", "telkomsel pasca merger", "telkomsel hasil merger"],
    },
    xlsmart: {
        key: "xlsmart",
        label: "XL Smart",
        color: "#2563eb",
        uploadKey: "xlsmart",
        uploadAliases: ["xl smart"],
    },
    ioh: {
        key: "ioh",
        label: "IOH",
        color: "#ca8a04",
        uploadKey: "ioh",
        uploadAliases: ["indosat ooredoo hutchison"],
    },
} as const;

/** Data klasifikasi operator lama. Angkanya tetap disimpan untuk perbandingan historis. */
export const MITRA_MARKET_SHARE_BEFORE_OPERATORS = [
    OPERATOR.telkomsel,
    OPERATOR.xl,
    OPERATOR.smartfren,
    OPERATOR.indosat,
    OPERATOR.tri,
] as const;

/**
 * Data pasca-merger yang diinput mandiri. Tidak ada nilai yang diturunkan dengan
 * menjumlahkan kolom sebelum merger, termasuk Telkomsel yang punya kolom tersendiri.
 */
export const MITRA_MARKET_SHARE_AFTER_OPERATORS = [
    OPERATOR.telkomselAfter,
    OPERATOR.xlsmart,
    OPERATOR.ioh,
] as const;

/** Seluruh field unik yang disimpan dan diterima oleh form maupun import. */
export const MITRA_MARKET_SHARE_FIELDS = [
    ...MITRA_MARKET_SHARE_BEFORE_OPERATORS,
    ...MITRA_MARKET_SHARE_AFTER_OPERATORS,
] as const;

export type MitraMarketShareKey = (typeof MITRA_MARKET_SHARE_FIELDS)[number]["key"];

/** Persentase dibatasi 0-100 dan disimpan sebagai decimal(5,2). */
export function normalizeSharePercent(input: unknown): string {
    const raw = typeof input === "number" ? input : Number(String(input ?? "").replace(",", "."));
    if (!Number.isFinite(raw)) return "0.00";
    return Math.min(Math.max(raw, 0), 100).toFixed(2);
}

function sumFields(
    values: Partial<Record<MitraMarketShareKey, string | number>>,
    fields: readonly { key: MitraMarketShareKey }[]
): number {
    return fields.reduce((total, field) => total + Number(values[field.key] ?? 0), 0);
}

export function sumBeforeShares(values: Partial<Record<MitraMarketShareKey, string | number>>): number {
    return sumFields(values, MITRA_MARKET_SHARE_BEFORE_OPERATORS);
}

export function sumAfterShares(values: Partial<Record<MitraMarketShareKey, string | number>>): number {
    return sumFields(values, MITRA_MARKET_SHARE_AFTER_OPERATORS);
}
