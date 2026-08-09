export interface MitraDetailField {
    key: string;
    label: string;
}

/**
 * Satu parameter beserta tiga kolomnya (M-1, M, MoM). Ini bentuk aslinya: tiap
 * parameter memang selalu punya tiga angka, jadi halaman publik bisa menyajikannya
 * sebagai satu baris tabel alih-alih tiga kartu terpisah.
 */
export interface MitraDetailRow {
    key: string;
    label: string;
    unit: "qty" | "rev";
    /** 0 = parameter induk, 1 = rincian di bawahnya (mis. per masa aktif voucher). */
    level: 0 | 1;
    /** Bulan sebelumnya secara penuh, sebagai pembanding pencapaian akhir bulan. */
    fm1Key: string;
    m1Key: string;
    mKey: string;
    momKey: string;
}

export interface MitraDetailFieldGroup {
    key: "sellthruDigipos" | "sellthruNota" | "rechargeDigipos";
    title: string;
    storageKey: "sellthruDigiposJson" | "sellthruNotaJson" | "rechargeDigiposJson";
    rows: MitraDetailRow[];
    /** Diturunkan dari rows supaya editor admin dan tabel publik tidak bisa berbeda. */
    fields: MitraDetailField[];
}

const UNIT_LABEL: Record<MitraDetailRow["unit"], string> = { qty: "qty", rev: "rev." };

function buildRow(base: string, label: string, unit: MitraDetailRow["unit"], level: 0 | 1 = 0): MitraDetailRow {
    return {
        key: `${base}_${unit}`,
        label,
        unit,
        level,
        fm1Key: `${base}_fm_1_${unit}`,
        m1Key: `${base}_m_1_${unit}`,
        mKey: `${base}_m_${unit}`,
        momKey: `mom_${base}_${unit}`,
    };
}

function rowToFields(row: MitraDetailRow): MitraDetailField[] {
    const unit = UNIT_LABEL[row.unit];
    return [
        // FM-1 ditaruh pertama mengikuti urutan bacanya di tabel; key parameter lain tidak
        // berubah sama sekali, jadi data yang sudah tersimpan tetap terbaca.
        { key: row.fm1Key, label: `${row.label} FM-1 (${unit})` },
        { key: row.m1Key, label: `${row.label} M-1 (${unit})` },
        { key: row.mKey, label: `${row.label} M (${unit})` },
        { key: row.momKey, label: `MoM ${row.label} (${unit})` },
    ];
}

/**
 * Masa aktif voucher internet. Hanya produk voucher yang dirinci begini; perdana, KPK,
 * dan vokos tidak punya pembagian masa aktif.
 */
const VALIDITAS_VOUCHER = [
    { key: "1h", label: "1 Hari" },
    { key: "2h", label: "2 Hari" },
    { key: "3h", label: "3 Hari" },
    { key: "5h", label: "5 Hari" },
    { key: "7h", label: "7 Hari" },
    { key: "28h", label: "28 Hari" },
];

const sellthruProducts: { key: string; label: string; validitas?: typeof VALIDITAS_VOUCHER }[] = [
    { key: "perdana_telkomsel", label: "Perdana Telkomsel" },
    { key: "perdana_byu", label: "Perdana byU" },
    { key: "kpk_telkomsel", label: "KPK Telkomsel" },
    { key: "kpk_byu", label: "KPK byU" },
    { key: "voucher_telkomsel", label: "Voucher Telkomsel", validitas: VALIDITAS_VOUCHER },
    { key: "voucher_byu", label: "Voucher byU", validitas: VALIDITAS_VOUCHER },
    { key: "vokos_telkomsel", label: "Vokos Telkomsel" },
    { key: "vokos_byu", label: "Vokos byU" },
];

function buildSellthruRows(prefix: "st" | "st_nota", labelPrefix: string): MitraDetailRow[] {
    return sellthruProducts.flatMap((product) => {
        const base = `${prefix}_${product.key}`;
        const label = `${labelPrefix} ${product.label}`;

        // Baris induk tetap ada walau produknya dirinci: angkanya adalah total seluruh masa
        // aktif, dan itu yang selama ini dipakai laporan. Rincian ditambahkan di bawahnya,
        // bukan menggantikannya, sehingga key lama tidak ada yang berubah.
        const induk = [buildRow(base, label, "qty"), buildRow(base, label, "rev")];
        if (!product.validitas) return induk;

        const rincian = product.validitas.flatMap((validitas) => {
            const baseRincian = `${base}_${validitas.key}`;
            const labelRincian = `${label} ${validitas.label}`;
            return [
                buildRow(baseRincian, labelRincian, "qty", 1),
                buildRow(baseRincian, labelRincian, "rev", 1),
            ];
        });

        return [...induk, ...rincian];
    });
}

const rechargeProducts = [
    { key: "omzet", label: "Omzet", hasRev: true },
    { key: "rech_pulsa", label: "Rech. Pulsa", hasRev: true },
    { key: "inject_voucher", label: "Inject Voucher", hasRev: true },
    { key: "cvm", label: "CVM", hasRev: true },
    { key: "aktifasi_sa", label: "Aktifasi SA", hasRev: true },
    { key: "so_sellout", label: "SO / SellOut", hasRev: false },
    { key: "redeem_vo", label: "Redeem Vo.", hasRev: true },
    { key: "scan_so", label: "Scan SO", hasRev: true },
];

const rechargeDigiposRows = rechargeProducts.flatMap((product) => {
    const qtyRow = buildRow(product.key, product.label, "qty");
    if (!product.hasRev) return [qtyRow];
    return [qtyRow, buildRow(product.key, product.label, "rev")];
});

const detailGroups: Omit<MitraDetailFieldGroup, "fields">[] = [
    {
        key: "sellthruDigipos",
        title: "Sellthru Digipos",
        storageKey: "sellthruDigiposJson",
        rows: buildSellthruRows("st", "ST"),
    },
    {
        key: "sellthruNota",
        title: "Sellthru Nota",
        storageKey: "sellthruNotaJson",
        rows: buildSellthruRows("st_nota", "ST Nota"),
    },
    {
        key: "rechargeDigipos",
        title: "Recharge Digipos",
        storageKey: "rechargeDigiposJson",
        rows: rechargeDigiposRows,
    },
];

export const MITRA_DETAIL_FIELD_GROUPS: MitraDetailFieldGroup[] = detailGroups.map((group) => ({
    ...group,
    fields: group.rows.flatMap(rowToFields),
}));

export function sanitizeDetailGroup(input: unknown, allowedKeys: string[]): Record<string, number> {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};

    const source = input as Record<string, unknown>;
    const result: Record<string, number> = {};

    for (const key of allowedKeys) {
        const raw = source[key];
        if (raw === "" || raw === null || raw === undefined) continue;

        const value = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
        if (Number.isFinite(value)) {
            result[key] = value;
        }
    }

    return result;
}

export function getDetailFieldLabels() {
    return MITRA_DETAIL_FIELD_GROUPS.flatMap((group) =>
        group.fields.map((field) => ({ ...field, group: group.title }))
    );
}
