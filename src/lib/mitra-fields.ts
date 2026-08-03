export interface MitraDetailField {
    key: string;
    label: string;
}

export interface MitraDetailFieldGroup {
    key: "sellthruDigipos" | "sellthruNota" | "rechargeDigipos";
    title: string;
    storageKey: "sellthruDigiposJson" | "sellthruNotaJson" | "rechargeDigiposJson";
    fields: MitraDetailField[];
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

function buildSellthruFields(prefix: "st" | "st_nota", labelPrefix: string): MitraDetailField[] {
    return sellthruProducts.flatMap((product) => [
        { key: `${prefix}_${product.key}_m_1_qty`, label: `${labelPrefix} ${product.label} M-1 (qty)` },
        { key: `${prefix}_${product.key}_m_qty`, label: `${labelPrefix} ${product.label} M (qty)` },
        { key: `mom_${prefix}_${product.key}_qty`, label: `MoM ${labelPrefix} ${product.label} (qty)` },
        { key: `${prefix}_${product.key}_m_1_rev`, label: `${labelPrefix} ${product.label} M-1 (rev.)` },
        { key: `${prefix}_${product.key}_m_rev`, label: `${labelPrefix} ${product.label} M (rev.)` },
        { key: `mom_${prefix}_${product.key}_rev`, label: `MoM ${labelPrefix} ${product.label} (rev.)` },
    ]);
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

const rechargeDigiposFields = rechargeProducts.flatMap((product) => {
    const qtyFields = [
        { key: `${product.key}_m_1_qty`, label: `${product.label} M-1 (qty)` },
        { key: `${product.key}_m_qty`, label: `${product.label} M (qty)` },
        { key: `mom_${product.key}_qty`, label: `MoM ${product.label} (qty)` },
    ];

    if (!product.hasRev) return qtyFields;

    return [
        ...qtyFields,
        { key: `${product.key}_m_1_rev`, label: `${product.label} M-1 (rev.)` },
        { key: `${product.key}_m_rev`, label: `${product.label} M (rev.)` },
        { key: `mom_${product.key}_rev`, label: `MoM ${product.label} (rev.)` },
    ];
});

export const MITRA_DETAIL_FIELD_GROUPS: MitraDetailFieldGroup[] = [
    {
        key: "sellthruDigipos",
        title: "Sellthru Digipos",
        storageKey: "sellthruDigiposJson",
        fields: buildSellthruFields("st", "ST"),
    },
    {
        key: "sellthruNota",
        title: "Sellthru Nota",
        storageKey: "sellthruNotaJson",
        fields: buildSellthruFields("st_nota", "ST Nota"),
    },
    {
        key: "rechargeDigipos",
        title: "Recharge Digipos",
        storageKey: "rechargeDigiposJson",
        fields: rechargeDigiposFields,
    },
];

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
