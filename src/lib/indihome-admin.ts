export const INDIHOME_LEAD_STATUSES = [
    "NEW",
    "CONTACTED",
    "SURVEY",
    "SUBMITTED",
    "CLOSED",
    "CANCELLED",
] as const;

export type IndihomeLeadStatus = (typeof INDIHOME_LEAD_STATUSES)[number];

/**
 * `allowedLocations` is passed in by the caller (read from indihome_locations) instead of
 * being checked against a hardcoded list, so a location added from the admin can be
 * assigned to a package straight away.
 */
export function parseIndihomeProductInput(body: Record<string, unknown>, allowedLocations: string[]) {
    const name = String(body.name || "").trim();
    const speedMbps = Number(body.speedMbps);
    const monthlyPrice = Number(body.monthlyPrice);
    const description = String(body.description || "").trim();
    const features = Array.isArray(body.features)
        ? body.features.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
        : [];
    const locations = Array.isArray(body.locations)
        ? body.locations.map(String).filter((item) => allowedLocations.includes(item))
        : [];

    if (name.length < 3 || name.length > 255) return { error: "Nama paket belum valid." } as const;
    if (!Number.isInteger(speedMbps) || speedMbps < 10 || speedMbps > 10_000) return { error: "Kecepatan paket belum valid." } as const;
    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0 || monthlyPrice > 1_000_000_000) return { error: "Harga paket belum valid." } as const;
    if (description.length < 10 || description.length > 2_000) return { error: "Deskripsi paket minimal 10 karakter." } as const;
    if (features.length === 0) return { error: "Tambahkan minimal satu fitur paket." } as const;
    if (locations.length === 0) return { error: "Pilih minimal satu lokasi." } as const;

    return {
        values: {
            name,
            speedMbps,
            monthlyPrice: monthlyPrice.toFixed(2),
            description,
            features,
            locations,
            isFeatured: body.isFeatured === true,
            isActive: body.isActive !== false,
            sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        },
    } as const;
}

export function isIndihomeLeadStatus(value: string): value is IndihomeLeadStatus {
    return INDIHOME_LEAD_STATUSES.some((status) => status === value);
}
