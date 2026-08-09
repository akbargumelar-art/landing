"use client";

import React from "react";
import Link from "next/link";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

import { buildOutletMapsUrl } from "@/lib/mitra-outlet-options";
import { hitungOccupancy, infoKategori, type OdpCategory } from "@/lib/indihome-odp";

import "leaflet/dist/leaflet.css";

export interface OdpMarker {
    id: string;
    code: string | null;
    kabupaten: string;
    kecamatan: string;
    latitude: number;
    longitude: number;
    portTotal: number;
    portUsed: number;
    portAvailable: number;
    category: OdpCategory | null;
}

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
function pinOutlet(fokus: boolean) {
    const ukuran = fokus ? 40 : 32;
    // Bentuk toko: kanopi bergelombang di atas, badan bangunan, pintu di tengah. Dipilih
    // agar penanda outlet berbeda bentuk -- bukan hanya beda warna -- dari penanda ODP,
    // sehingga tetap terbaca oleh yang kesulitan membedakan warna.
    return L.divIcon({
        className: "",
        html: `
            <span style="display:block;width:${ukuran}px;height:${ukuran}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));${fokus ? "animation:pulsa-marker 1.2s ease-in-out infinite;" : ""}">
                <svg viewBox="0 0 24 24" width="${ukuran}" height="${ukuran}">
                    <path d="M12 2c4.4 0 8 3.4 8 7.6 0 5.2-6.3 11.1-7.4 12.1a.9.9 0 0 1-1.2 0C10.3 20.7 4 14.8 4 9.6 4 5.4 7.6 2 12 2z"
                          fill="#dc2626" stroke="#fff" stroke-width="1.4"/>
                    <path d="M8 7.4h8v1.3a1.3 1.3 0 0 1-2 0 1.3 1.3 0 0 1-2 0 1.3 1.3 0 0 1-2 0 1.3 1.3 0 0 1-2 0z" fill="#fff"/>
                    <path d="M8.7 9.6h6.6v4.6h-2.4v-2.7h-1.8v2.7H8.7z" fill="#fff"/>
                </svg>
            </span>
            ${fokus ? `<style>
                @keyframes pulsa-marker {
                    0%, 100% { transform: scale(1); }
                    50%      { transform: scale(1.12); }
                }
            </style>` : ""}`,
        iconSize: [ukuran, ukuran],
        // Ujung bawah pin yang menunjuk lokasi, bukan tengahnya.
        iconAnchor: [ukuran / 2, ukuran],
        popupAnchor: [0, -ukuran + 6],
    });
}

const ikonOutlet = pinOutlet(false);
const ikonOutletFokus = pinOutlet(true);

/**
 * Penanda ODP: kotak terminal dengan tiga port dan kabel menjuntai -- bentuk yang lazim
 * dikenali sebagai perangkat fix broadband di lapangan. Warnanya mengikuti kategori.
 */
function ikonOdp(warna: string) {
    return L.divIcon({
        className: "",
        html: `
            <span style="display:block;width:26px;height:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));">
                <svg viewBox="0 0 24 24" width="26" height="26">
                    <rect x="4" y="5" width="16" height="12" rx="2.5" fill="${warna}" stroke="#fff" stroke-width="1.6"/>
                    <circle cx="8.5" cy="11" r="1.25" fill="#fff"/>
                    <circle cx="12" cy="11" r="1.25" fill="#fff"/>
                    <circle cx="15.5" cy="11" r="1.25" fill="#fff"/>
                    <path d="M12 17v3" stroke="${warna}" stroke-width="2.2" stroke-linecap="round"/>
                    <path d="M12 17v3" stroke="#fff" stroke-width="1" stroke-linecap="round"/>
                </svg>
            </span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -12],
    });
}

/**
 * Titik posisi pengguna dibuat biru dan berdenyut supaya tidak tertukar dengan penanda
 * outlet maupun ODP -- ketiganya sering berdekatan justru ketika fitur ini dipakai.
 */
const ikonPengguna = L.divIcon({
    className: "",
    html: `
        <span style="
            display:block;width:18px;height:18px;border-radius:9999px;
            background:#2563eb;border:3px solid #fff;
            box-shadow:0 0 0 5px rgba(37,99,235,.25), 0 2px 6px rgba(0,0,0,.35);
            animation:pulsa-pengguna 1.6s ease-in-out infinite;
        "></span>
        <style>
            @keyframes pulsa-pengguna {
                0%, 100% { box-shadow: 0 0 0 5px rgba(37,99,235,.25), 0 2px 6px rgba(0,0,0,.35); }
                50%      { box-shadow: 0 0 0 11px rgba(37,99,235,.10), 0 2px 6px rgba(0,0,0,.35); }
            }
        </style>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
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

/**
 * Leaflet menghitung titik tengah dari ukuran kotak yang ia simpan sendiri, dan ukuran
 * itu hanya diperbarui lewat invalidateSize(). Begitu panel Street View terbuka dan peta
 * menyempit jadi setengah lebar, Leaflet masih memakai lebar lama -- penanda yang
 * seharusnya di tengah jadi bergeser ke kanan, persis seperti yang terlihat.
 *
 * ResizeObserver dipakai, bukan event resize window, karena yang berubah adalah kotak
 * petanya sendiri sementara ukuran jendela sama sekali tidak berubah.
 */
function IkutiUkuranKotak({ focusedToken, markers }: { focusedToken: string | null; markers: OutletMarker[] }) {
    const map = useMap();
    // Disimpan di ref supaya observer tidak dibuat ulang tiap penanda berubah.
    const fokusRef = React.useRef<OutletMarker | null>(null);
    fokusRef.current = markers.find((m) => m.publicToken === focusedToken) || null;

    React.useEffect(() => {
        const container = map.getContainer();
        const observer = new ResizeObserver(() => {
            map.invalidateSize({ animate: false });

            // Setelah ukuran benar, penanda yang sedang difokuskan dikembalikan ke tengah.
            const target = fokusRef.current;
            if (target) {
                map.setView([target.latitude, target.longitude], map.getZoom(), { animate: false });
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, [map]);

    return null;
}

/** Terbang halus ke outlet yang difokuskan dan buka popup-nya secara otomatis. */
function TerbangKeFokus({ focusedToken, markers }: { focusedToken: string | null; markers: OutletMarker[] }) {
    const map = useMap();

    React.useEffect(() => {
        if (!focusedToken) return;

        const target = markers.find((m) => m.publicToken === focusedToken);
        if (!target) return;

        // Ukuran disegarkan lebih dulu: panel Street View terbuka pada saat yang sama
        // dengan pemanggilan ini, jadi tanpa ini tujuan terbangnya dihitung dari lebar lama.
        map.invalidateSize({ animate: false });
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

            // Popup yang terbuka memicu autoPan bawaan Leaflet bila dirasa tidak muat,
            // dan itu menggeser penanda dari tengah lagi. Dikembalikan setelahnya.
            map.setView([target.latitude, target.longitude], map.getZoom(), { animate: false });
        }, 1300);

        return () => window.clearTimeout(timer);
    }, [focusedToken, map, markers]);

    return null;
}

/**
 * Terbang ke posisi pengguna setiap kali pembacaan baru masuk. `stempel` dipakai sebagai
 * pemicu, bukan koordinatnya: menekan tombol dua kali di tempat yang sama menghasilkan
 * koordinat identik, dan tanpa stempel peta tidak akan bergerak kembali setelah pengguna
 * menggeser petanya sendiri.
 */
function TerbangKePengguna({ posisi }: { posisi: PosisiPengguna | null }) {
    const map = useMap();

    React.useEffect(() => {
        if (!posisi) return;
        map.invalidateSize({ animate: false });
        map.flyTo([posisi.lat, posisi.lng], 16, { duration: 1.2 });
    }, [map, posisi]);

    return null;
}

export interface PosisiPengguna {
    lat: number;
    lng: number;
    accuracy: number;
    stempel: number;
}

export default function OutletMap({
    markers,
    focusedToken = null,
    onStreetView,
    userPosition = null,
    odp = [],
}: {
    markers: OutletMarker[];
    focusedToken?: string | null;
    /** Tidak diisi bila API key Street View belum dipasang; tombolnya ikut hilang. */
    onStreetView?: (publicToken: string) => void;
    userPosition?: PosisiPengguna | null;
    odp?: OdpMarker[];
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
            <TerbangKePengguna posisi={userPosition} />
            <IkutiUkuranKotak focusedToken={focusedToken} markers={markers} />
            <TerbangKeFokus focusedToken={focusedToken} markers={markers} />

            {userPosition && (
                <>
                    {/* Lingkaran ketelitian menjelaskan mengapa titiknya bisa meleset --
                        tanpa itu pengguna mengira aplikasinya yang salah membaca lokasi. */}
                    <Circle
                        center={[userPosition.lat, userPosition.lng]}
                        radius={Math.max(userPosition.accuracy, 15)}
                        pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.12, weight: 1 }}
                    />
                    <Marker position={[userPosition.lat, userPosition.lng]} icon={ikonPengguna}>
                        <Popup>
                            <span className="block text-sm font-bold text-gray-950">Lokasi Anda</span>
                            <span className="mt-0.5 block text-xs text-gray-600">
                                Ketelitian sekitar {Math.round(userPosition.accuracy)} m
                            </span>
                        </Popup>
                    </Marker>
                </>
            )}

            {/* ODP digambar sebelum outlet supaya penanda outlet berada di lapisan atas
                ketika keduanya bertumpuk -- outlet yang lebih sering diklik. */}
            {odp.map((titik) => {
                const kategori = infoKategori(titik.category, titik.portUsed, titik.portTotal);
                const occupancy = hitungOccupancy(titik.portUsed, titik.portTotal);

                return (
                    <Marker key={titik.id} position={[titik.latitude, titik.longitude]} icon={ikonOdp(kategori.color)}>
                        <Popup>
                            <span className="block text-sm font-bold text-gray-950">
                                ODP {titik.code || titik.kecamatan}
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-600">
                                {titik.kecamatan}, {titik.kabupaten}
                            </span>
                            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: kategori.color }}>
                                {kategori.label}
                            </span>
                            <span className="mt-2 block text-xs text-gray-700">
                                Port: <strong>{titik.portTotal}</strong> total, {titik.portUsed} terpakai, {titik.portAvailable} tersedia
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-700">
                                Occupancy: <strong>{occupancy.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</strong>
                            </span>
                            <a
                                href={buildOutletMapsUrl(titik.latitude, titik.longitude)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 block text-xs font-semibold text-red-600 hover:underline"
                            >
                                Buka lokasi ODP di Google Maps
                            </a>
                        </Popup>
                    </Marker>
                );
            })}

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
                            {onStreetView && (
                                <button
                                    type="button"
                                    onClick={() => onStreetView(outlet.publicToken)}
                                    className="text-left text-xs font-semibold text-red-600 hover:underline"
                                >
                                    Lihat Street View
                                </button>
                            )}
                            <Link
                                href={`/mitra/o/${outlet.publicToken}`}
                                className="text-xs font-semibold text-red-600 hover:underline"
                            >
                                Lihat profil outlet
                            </Link>
                            <a
                                href={buildOutletMapsUrl(outlet.latitude, outlet.longitude)}
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
