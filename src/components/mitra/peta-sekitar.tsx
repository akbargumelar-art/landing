"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import React from "react";
import { MapPin, Router, Store } from "lucide-react";

import type { OdpMarker, OutletMarker } from "@/components/mitra/outlet-map";
import { formatJarak } from "@/lib/geo";
import { WARNA_ODP_PUBLIK } from "@/lib/indihome-odp";

/**
 * Peta sekitar pada profil publik outlet -- bagian yang tidak menunggu OTP.
 *
 * Titik ODP di sini sengaja tanpa rincian: hanya koordinatnya yang digambar, sedangkan
 * nama, kapasitas port, dan occupancy tetap terbuka hanya di halaman detail ber-OTP.
 * Karena itu showOdpDetails tidak dinyalakan dan endpoint yang dipakai pun berbeda.
 */
const OutletMap = dynamic(() => import("@/components/mitra/outlet-map"), {
    ssr: false,
    loading: () => (
        <div className="flex h-64 w-full items-center justify-center bg-gray-100 text-sm text-muted-foreground">
            Memuat peta...
        </div>
    ),
});

interface OutletSekitar extends OutletMarker {
    jarak: number;
}

const BATAS_DAFTAR = 5;

export function PetaSekitar({ outlet }: { outlet: OutletMarker }) {
    const [odp, setOdp] = React.useState<OdpMarker[]>([]);
    const [sekitar, setSekitar] = React.useState<OutletSekitar[]>([]);
    const [radiusMeter, setRadiusMeter] = React.useState(1500);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetch(`/api/public/mitra/outlets/${outlet.publicToken}/sekitar`)
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                setOdp(Array.isArray(data?.odp) ? data.odp : []);
                setSekitar(Array.isArray(data?.outlets) ? data.outlets : []);
                if (typeof data?.radiusMeter === "number") setRadiusMeter(data.radiusMeter);
            })
            .catch(() => {
                setOdp([]);
                setSekitar([]);
            })
            .finally(() => setLoading(false));
    }, [outlet.publicToken]);

    // Outlet yang sedang dibuka selalu ikut digambar, walaupun tidak ada apa pun di
    // sekitarnya: petanya tetap menjawab "outlet ini di sebelah mana".
    const markers = React.useMemo(() => [outlet, ...sekitar], [outlet, sekitar]);

    return (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-4">
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-600" />
                    <div>
                        <h2 className="font-bold">Sekitar Outlet</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Titik ODP IndiHome dan outlet lain dalam radius {formatJarak(radiusMeter)}.
                            Kapasitas port tiap ODP hanya terbuka setelah OTP.
                        </p>
                    </div>
                </div>
                {!loading && (
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Warna tiap lencana disamakan dengan warna penandanya di peta, supaya
                            legenda ini juga menjelaskan mengapa penanda outlet ini dan
                            tetangganya tidak sewarna. */}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold">
                            <Store className="h-3.5 w-3.5 text-red-600" />
                            Outlet ini
                        </span>
                        {sekitar.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold">
                                <Store className="h-3.5 w-3.5 text-slate-500" />
                                {sekitar.length} outlet lain
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold">
                            <Router className="h-3.5 w-3.5" style={{ color: WARNA_ODP_PUBLIK }} />
                            {odp.length} titik ODP
                        </span>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Memuat peta sekitar...</div>
            ) : (
                <>
                    <OutletMap markers={markers} odp={odp} highlightedToken={outlet.publicToken} />

                    {sekitar.length > 0 && (
                        <div className="divide-y border-t">
                            {sekitar.slice(0, BATAS_DAFTAR).map((tetangga) => (
                                <Link
                                    key={tetangga.publicToken}
                                    href={`/mitra/o/${tetangga.publicToken}`}
                                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition-colors hover:bg-gray-50"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-gray-950">{tetangga.name}</span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {tetangga.outletCode} - {tetangga.kecamatan}, {tetangga.kabupaten}
                                        </span>
                                    </span>
                                    <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                                        {formatJarak(tetangga.jarak)}
                                    </span>
                                </Link>
                            ))}

                            {sekitar.length > BATAS_DAFTAR && (
                                <p className="px-5 py-3 text-xs text-muted-foreground">
                                    dan {sekitar.length - BATAS_DAFTAR} outlet lain di dalam radius ini. Klik penandanya di peta.
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
