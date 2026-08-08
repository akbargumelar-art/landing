"use client";

import React from "react";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

export interface OutletMarker {
    publicToken: string;
    outletCode: string;
    name: string;
    kabupaten: string;
    kecamatan: string;
    latitude: number;
    longitude: number;
}

/**
 * Ikon penanda sendiri, bukan ikon bawaan Leaflet.
 *
 * Ikon bawaan dimuat lewat URL relatif terhadap berkas CSS-nya, yang rusak begitu aset
 * di-bundle dan diberi hash oleh Next.js -- gejalanya penanda hilang tanpa error. divIcon
 * berbasis HTML menghindari masalah itu sepenuhnya dan sekaligus mengikuti warna merek.
 */
const ikonOutlet = L.divIcon({
    className: "",
    html: `
        <span style="
            display:block;width:22px;height:22px;border-radius:9999px;
            background:#dc2626;border:3px solid #fff;
            box-shadow:0 2px 6px rgba(0,0,0,.35);
        "></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
});

/** Ikon lebih besar & berdenyut untuk outlet yang sedang difokuskan. */
const ikonOutletFokus = L.divIcon({
    className: "",
    html: `
        <span style="
            display:block;width:30px;height:30px;border-radius:9999px;
            background:#dc2626;border:4px solid #fef08a;
            box-shadow:0 0 0 6px rgba(220,38,38,.3), 0 2px 8px rgba(0,0,0,.4);
            animation:pulsa-marker 1.2s ease-in-out infinite;
        "></span>
        <style>
            @keyframes pulsa-marker {
                0%, 100% { box-shadow: 0 0 0 6px rgba(220,38,38,.3), 0 2px 8px rgba(0,0,0,.4); }
                50%      { box-shadow: 0 0 0 12px rgba(220,38,38,.12), 0 2px 8px rgba(0,0,0,.4); }
            }
        </style>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
});

/** Menyesuaikan tampilan peta agar seluruh penanda muat setiap kali daftarnya berubah. */
function SesuaikanTampilan({ markers }: { markers: OutletMarker[] }) {
    const map = useMap();

    React.useEffect(() => {
        if (markers.length === 0) return;

        if (markers.length === 1) {
            map.setView([markers[0].latitude, markers[0].longitude], 15);
            return;
        }

        const bounds = L.latLngBounds(markers.map((m) => [m.latitude, m.longitude] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }, [map, markers]);

    return null;
}

/** Terbang halus ke outlet yang difokuskan dan buka popup-nya secara otomatis. */
function TerbangKeFokus({ focusedToken, markers }: { focusedToken: string | null; markers: OutletMarker[] }) {
    const map = useMap();

    React.useEffect(() => {
        if (!focusedToken) return;

        const target = markers.find((m) => m.publicToken === focusedToken);
        if (!target) return;

        map.flyTo([target.latitude, target.longitude], 17, { duration: 1.2 });

        // Buka popup penanda yang cocok setelah animasi selesai.
        const timer = window.setTimeout(() => {
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                    const pos = layer.getLatLng();
                    if (
                        Math.abs(pos.lat - target.latitude) < 0.00001 &&
                        Math.abs(pos.lng - target.longitude) < 0.00001
                    ) {
                        layer.openPopup();
                    }
                }
            });
        }, 1300);

        return () => window.clearTimeout(timer);
    }, [focusedToken, map, markers]);

    return null;
}

export default function OutletMap({
    markers,
    focusedToken = null,
}: {
    markers: OutletMarker[];
    focusedToken?: string | null;
}) {
    // Cirebon sebagai tampilan awal sebelum penanda dimuat, supaya peta tidak
    // sempat memperlihatkan tengah samudra.
    const tengahAwal: [number, number] = [-6.732, 108.549];

    return (
        <MapContainer
            center={tengahAwal}
            zoom={11}
            scrollWheelZoom={false}
            className="h-[360px] w-full sm:h-[460px]"
            style={{ background: "#e5e7eb" }}
        >
            <TileLayer
                // Atribusi wajib menurut ketentuan penggunaan ubin OpenStreetMap.
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
            />
            <SesuaikanTampilan markers={markers} />
            <TerbangKeFokus focusedToken={focusedToken} markers={markers} />

            {markers.map((outlet) => (
                <Marker
                    key={outlet.publicToken}
                    position={[outlet.latitude, outlet.longitude]}
                    icon={focusedToken === outlet.publicToken ? ikonOutletFokus : ikonOutlet}
                >
                    <Popup>
                        <span className="block text-sm font-bold text-gray-950">{outlet.name}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{outlet.outletCode}</span>
                        <span className="mt-1 block text-xs text-gray-600">
                            {outlet.kecamatan}, {outlet.kabupaten}
                        </span>
                        <span className="mt-2 flex flex-col gap-1">
                            <Link
                                href={`/mitra/o/${outlet.publicToken}`}
                                className="text-xs font-semibold text-red-600 hover:underline"
                            >
                                Lihat profil outlet
                            </Link>
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${outlet.latitude},${outlet.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-red-600 hover:underline"
                            >
                                Buka rute di Google Maps
                            </a>
                        </span>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
