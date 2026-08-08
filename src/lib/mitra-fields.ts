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

function buildRow(base: string, label: string, unit: MitraDetailRow["unit"]): MitraDetailRow {
    return {
        key: `${base}_${unit}`,
        label,
        unit,
        m1Key: `${base}_m_1_${unit}`,
        mKey: `${base}_m_${unit}`,
        momKey: `mom_${base}_${unit}`,
    };
}

function rowToFields(row: MitraDetailRow): MitraDetailField[] {
    const unit = UNIT_LABEL[row.unit];
    return [
        { key: row.m1Key, label: `${row.label} M-1 (${unit})` },
        { key: row.mKey, label: `${row.label} M (${unit})` },
        { key: row.momKey, label: `MoM ${row.label} (${unit})` },
    ];
}

const sellthruProducts = [
    { key: "perdana_telkomsel", label: "Perdana Telkomsel" },
    { key: "perdana_byu", label: "Perdana byU" },
    { key: "kpk_telkomsel", label: "KPK Telkomsel" },
    { key: "kpk_byu", label: "KPK byU" },
    { key: "voucher_telkomsel", label: "Voucher Telkomsel" },
    { key: "voucher_byu", label: "Voucher byU" },
    { key: "vokos_telkomsel", label: "Vokos Telkomsel" },
    { key: "vokos_byu", label: "Vokos byU" },
];

function buildSellthruRows(prefix: "st" | "st_nota", labelPrefix: string): MitraDetailRow[] {
    return sellthruProducts.flatMap((product) => {
        const base = `${prefix}_${product.key}`;
        const label = `${labelPrefix} ${product.label}`;
        return [buildRow(base, label, "qty"), buildRow(base, label, "rev")];
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
