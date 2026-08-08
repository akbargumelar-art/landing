/**
 * Status pemegang nomor whitelist, dipakai kolom `keterangan`.
 *
 * Daftar ini satu-satunya sumber: form admin memakainya sebagai saran isian, dan
 * pemeriksaan izin di server memakainya untuk menentukan siapa yang boleh menyunting
 * data outlet dari halaman detail.
 */
export const PERAN_BOLEH_EDIT = [
    "salesforce",
    "merchandiser",
    "supervisor",
    "manager",
    "organik telkomsel",
] as const;

/** Ditawarkan di form admin; Outlet Owner sengaja ada tetapi TIDAK boleh menyunting. */
export const SARAN_KETERANGAN = [
    "Outlet Owner",
    "Salesforce",
    "Merchandiser",
    "Supervisor",
    "Manager",
    "Organik Telkomsel",
];

/**
 * Kolom keterangan berupa teks bebas, jadi pencocokannya memakai "mengandung", bukan
 * "sama dengan": isian nyata di lapangan sering berbentuk "Salesforce PJP Kuningan" atau
 * "Manager Area". Konsekuensinya kalimat yang kebetulan memuat kata itu ikut lolos, jadi
 * kolom keterangan sebaiknya diisi peran saja, bukan catatan panjang.
 */
export function bolehEditOutlet(keterangan?: string | null): boolean {
    const teks = String(keterangan || "").trim().toLowerCase();
    if (!teks) return false;

    return PERAN_BOLEH_EDIT.some((peran) => teks.includes(peran));
}

export const PESAN_TIDAK_BOLEH_EDIT =
    "Nomor Anda terdaftar, tetapi statusnya tidak berhak mengubah data outlet. " +
    "Perubahan hanya bisa dilakukan salesforce, merchandiser, supervisor, manager, atau organik Telkomsel.";
