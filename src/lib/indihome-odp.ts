/**
 * Kategori ODP beserta warnanya di peta. Urutan dari paling longgar ke paling penuh,
 * dipakai juga sebagai urutan legenda.
 */
export const ODP_CATEGORIES = [
    { key: "GREEN", label: "Green", color: "#16a34a", keterangan: "Port masih longgar" },
    { key: "YELLOW", label: "Yellow", color: "#eab308", keterangan: "Mulai terisi" },
    { key: "ORANGE", label: "Orange", color: "#ea580c", keterangan: "Hampir penuh" },
    { key: "BLACK", label: "Black", color: "#171717", keterangan: "Penuh atau hampir habis" },
] as const;

export type OdpCategory = (typeof ODP_CATEGORIES)[number]["key"];

/**
 * Ambang penurunan kategori dari occupancy, dipakai HANYA ketika kolom kategori kosong.
 *
 * Angka ini asumsi, bukan ketentuan resmi Telkom -- kalau standar Anda berbeda, cukup
 * ubah di sini dan seluruh peta, legenda, serta admin ikut menyesuaikan.
 */
export const AMBANG_KATEGORI: { batas: number; kategori: OdpCategory }[] = [
    { batas: 90, kategori: "BLACK" },
    { batas: 70, kategori: "ORANGE" },
    { batas: 50, kategori: "YELLOW" },
];

/** Occupancy dalam persen: port terpakai dibanding seluruh port. */
export function hitungOccupancy(portUsed: number, portTotal: number): number {
    if (!portTotal || portTotal <= 0) return 0;
    return Math.min(Math.max((portUsed / portTotal) * 100, 0), 100);
}

export function turunkanKategori(portUsed: number, portTotal: number): OdpCategory {
    const occupancy = hitungOccupancy(portUsed, portTotal);
    return AMBANG_KATEGORI.find((aturan) => occupancy >= aturan.batas)?.kategori || "GREEN";
}

export function infoKategori(kategori: OdpCategory | null | undefined, portUsed = 0, portTotal = 0) {
    const kunci = kategori || turunkanKategori(portUsed, portTotal);
    return ODP_CATEGORIES.find((item) => item.key === kunci) || ODP_CATEGORIES[0];
}

export function normalizeKategori(input: unknown): OdpCategory | null {
    const teks = String(input ?? "").trim().toUpperCase();
    return ODP_CATEGORIES.some((item) => item.key === teks) ? (teks as OdpCategory) : null;
}
