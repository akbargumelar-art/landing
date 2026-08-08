/**
 * Empat slot foto outlet. Daftar ini satu-satunya tempat yang menentukan slot apa saja
 * yang ada, labelnya, dan kolom mana yang dipakai -- API, profil publik, halaman detail,
 * dan editor admin semuanya membacanya dari sini.
 */
export const MITRA_PHOTO_SLOTS = [
    {
        key: "depan",
        label: "Tampak Depan",
        hint: "Foto utama outlet, tampil di direktori dan peta.",
        urlColumn: "photoUrl",
        atColumn: "photoUpdatedAt",
        utama: true,
    },
    {
        key: "etalase",
        label: "Etalase",
        hint: "Bagian dalam atau etalase penjualan.",
        urlColumn: "photoEtalaseUrl",
        atColumn: "photoEtalaseUpdatedAt",
        utama: false,
    },
    {
        key: "pop_telkomsel",
        label: "POP Material Telkomsel",
        hint: "Materi promosi Telkomsel yang terpasang.",
        urlColumn: "photoPopTelkomselUrl",
        atColumn: "photoPopTelkomselUpdatedAt",
        utama: false,
    },
    {
        key: "pop_kompetitor",
        label: "POP Kompetitor",
        hint: "Materi promosi operator lain di outlet yang sama.",
        urlColumn: "photoPopKompetitorUrl",
        atColumn: "photoPopKompetitorUpdatedAt",
        utama: false,
    },
] as const;

export type MitraPhotoSlotKey = (typeof MITRA_PHOTO_SLOTS)[number]["key"];

export function findPhotoSlot(key: unknown) {
    return MITRA_PHOTO_SLOTS.find((slot) => slot.key === String(key ?? "")) || null;
}

/**
 * Kunjungan salesforce dijadwalkan mingguan, jadi foto yang belum diperbarui lebih dari
 * tujuh hari menandakan kunjungan terakhir sudah lewat jadwalnya.
 */
export const BATAS_SEGAR_HARI = 7;

export interface StatusFoto {
    label: string;
    /** true bila foto sudah lewat jadwal pembaruan atau belum pernah diisi. */
    perluDiperbarui: boolean;
    umurHari: number | null;
}

export function statusFoto(updatedAt: string | Date | null | undefined): StatusFoto {
    if (!updatedAt) {
        return { label: "Belum pernah diperbarui", perluDiperbarui: true, umurHari: null };
    }

    const selisihMs = Date.now() - new Date(updatedAt).getTime();
    const umurHari = Math.floor(selisihMs / (24 * 60 * 60 * 1000));

    if (umurHari <= 0) return { label: "Diperbarui hari ini", perluDiperbarui: false, umurHari: 0 };
    if (umurHari === 1) return { label: "Diperbarui kemarin", perluDiperbarui: false, umurHari: 1 };

    return {
        label: `Diperbarui ${umurHari} hari lalu`,
        perluDiperbarui: umurHari > BATAS_SEGAR_HARI,
        umurHari,
    };
}

export function formatTanggalFoto(updatedAt: string | Date | null | undefined): string {
    if (!updatedAt) return "-";
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(updatedAt));
}
