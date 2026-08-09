"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Router } from "lucide-react";

import type { OdpMarker, OutletMarker } from "@/components/mitra/outlet-map";
import { ODP_CATEGORIES, hitungOccupancy, infoKategori } from "@/lib/indihome-odp";
import { formatJarak } from "@/lib/geo";

/**
 * Memakai komponen peta yang sama dengan direktori outlet, bukan peta kedua. Perilaku
 * "muat ODP mengikuti area" tidak ikut menyala karena onAreaChange sengaja tidak diisi --
 * di sini titiknya sudah ditentukan sekali dari radius sekitar outlet.
 */
const OutletMap = dynamic(() => import("@/components/mitra/outlet-map"), {
    ssr: false,
    loading: () => (
        <div className="flex h-64 w-full items-center justify-center bg-gray-100 text-sm text-muted-foreground">
            Memuat peta...
        </div>
    ),
});

interface OdpDenganJarak extends OdpMarker {
    jarak: number;
}

const RADIUS_METER = 1500;

export function OdpSekitar({ outlet }: { outlet: OutletMarker }) {
    const [odp, setOdp] = React.useState<OdpDenganJarak[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const params = new URLSearchParams({
            near: `${outlet.latitude},${outlet.longitude}`,
            radius: String(RADIUS_METER),
        });

        fetch(`/api/public/indihome/odp?${params}`)
            .then((res) => res.ok ? res.json() : null)
            .then((data) => setOdp(Array.isArray(data?.odp) ? data.odp : []))
            .catch(() => setOdp([]))
            .finally(() => setLoading(false));
    }, [outlet.latitude, outlet.longitude]);

    // Kartu disembunyikan sepenuhnya bila tidak ada ODP di sekitar: kotak kosong bertuliskan
    // "tidak ada data" hanya menambah panjang halaman tanpa memberi tahu apa pun.
    if (!loading && odp.length === 0) return null;

    const ringkasan = ODP_CATEGORIES.map((kategori) => ({
        ...kategori,
        jumlah: odp.filter((titik) => infoKategori(titik.category, titik.portUsed, titik.portTotal).key === kategori.key).length,
    })).filter((kategori) => kategori.jumlah > 0);

    return (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-4">
                <div className="flex items-center gap-2">
                    <Router className="h-4 w-4 text-red-600" />
                    <div>
                        <h2 className="font-bold">ODP IndiHome di Sekitar</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Radius {formatJarak(RADIUS_METER)} dari outlet ini.
                        </p>
                    </div>
                </div>
                {!loading && (
                    <div className="flex flex-wrap items-center gap-2">
                        {ringkasan.map((kategori) => (
                            <span key={kategori.key} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold">
                                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: kategori.color }} />
                                {kategori.jumlah} {kategori.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Memuat titik ODP...</div>
            ) : (
                <>
                    <OutletMap markers={[outlet]} odp={odp} />

                    <div className="divide-y border-t">
                        {odp.slice(0, 5).map((titik) => {
                            const kategori = infoKategori(titik.category, titik.portUsed, titik.portTotal);
                            const occupancy = hitungOccupancy(titik.portUsed, titik.portTotal);

                            return (
                                <div key={titik.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                                    <span className="flex items-center gap-2">
                                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: kategori.color }} />
                                        <span className="text-sm font-semibold text-gray-950">
                                            ODP {titik.name || titik.kecamatan}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {titik.portUsed}/{titik.portTotal} port terpakai
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-3 text-xs">
                                        <span className="text-muted-foreground">
                                            {occupancy.toLocaleString("id-ID", { maximumFractionDigits: 0 })}% occupancy
                                        </span>
                                        <span className="rounded-full bg-blue-100 px-2 py-1 font-bold text-blue-700">
                                            {formatJarak(titik.jarak)}
                                        </span>
                                    </span>
                                </div>
                            );
                        })}

                        {odp.length > 5 && (
                            <p className="px-5 py-3 text-xs text-muted-foreground">
                                dan {odp.length - 5} titik ODP lain di dalam radius ini. Klik penanda di peta untuk rinciannya.
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
