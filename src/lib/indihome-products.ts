/**
 * Seed/fallback coverage areas. Since Fase 4 the live list lives in `indihome_locations`
 * and is managed from the admin - see `getActiveIndihomeLocations()`. These values are
 * only used to seed that table and to keep the page usable if the database is unreachable.
 */
export const INDIHOME_LOCATIONS = [
    "Kota Cirebon",
    "Kabupaten Cirebon",
    "Kabupaten Kuningan",
] as const;

export type IndihomeLocation = (typeof INDIHOME_LOCATIONS)[number];

export type IndihomeProduct = {
    id: string;
    name: string;
    speedMbps: number;
    monthlyPrice: number;
    description: string;
    features: string[];
    // Plain strings: coverage areas are database-driven and no longer a closed set.
    locations: string[];
    featured?: boolean;
};

export const INDIHOME_PRODUCTS: IndihomeProduct[] = [
    {
        id: "internet-75",
        name: "Internet Rumah 75",
        speedMbps: 75,
        monthlyPrice: 250_000,
        description: "Untuk browsing, belajar, dan hiburan keluarga sehari-hari.",
        features: ["Internet fiber", "Cocok hingga 5 perangkat", "Instalasi dikonfirmasi petugas"],
        locations: [...INDIHOME_LOCATIONS],
    },
    {
        id: "internet-100",
        name: "Internet Rumah 100",
        speedMbps: 100,
        monthlyPrice: 290_000,
        description: "Lebih leluasa untuk bekerja, streaming, dan belajar bersamaan.",
        features: ["Internet fiber", "Cocok hingga 8 perangkat", "Pilihan keluarga terpopuler"],
        locations: [...INDIHOME_LOCATIONS],
        featured: true,
    },
    {
        id: "internet-150",
        name: "Internet Rumah 150",
        speedMbps: 150,
        monthlyPrice: 325_000,
        description: "Koneksi cepat untuk rumah aktif dengan banyak perangkat.",
        features: ["Internet fiber", "Cocok hingga 12 perangkat", "Streaming resolusi tinggi"],
        locations: [...INDIHOME_LOCATIONS],
    },
    {
        id: "internet-200",
        name: "Internet Rumah 200",
        speedMbps: 200,
        monthlyPrice: 490_000,
        description: "Performa maksimal untuk produktivitas dan hiburan tanpa jeda.",
        features: ["Internet fiber", "Cocok hingga 15 perangkat", "Prioritas untuk rumah beraktivitas tinggi"],
        locations: ["Kota Cirebon", "Kabupaten Cirebon"],
    },
];

export function getIndihomeProduct(productId: string) {
    return INDIHOME_PRODUCTS.find((product) => product.id === productId);
}

export function isIndihomeLocation(value: string): value is IndihomeLocation {
    return INDIHOME_LOCATIONS.some((location) => location === value);
}
