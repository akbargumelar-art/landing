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

export default function OutletMap({ markers }: { markers: OutletMarker[] }) {
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

            {markers.map((outlet) => (
                <Marker
                    key={outlet.publicToken}
                    position={[outlet.latitude, outlet.longitude]}
                    icon={ikonOutlet}
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
