"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { ArrowRight, Crosshair, Loader2, MapPin, Navigation, Route, Router, Search, Store } from "lucide-react";

import dynamic from "next/dynamic";

import { QrOutletScanner } from "@/components/mitra/qr-outlet-scanner";
import { StreetViewPanel } from "@/components/mitra/street-view-panel";
import type { OdpMarker, OutletMarker, PosisiPengguna } from "@/components/mitra/outlet-map";
import { formatJarak, jarakMeter } from "@/lib/geo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STREET_VIEW_ENABLED } from "@/lib/street-view";

/**
 * Leaflet menyentuh `window` saat modulnya dimuat, jadi tidak bisa dirender di server.
 * Dimuat dinamis tanpa SSR sekaligus supaya bundel peta (leaflet + react-leaflet) tidak
 * ikut membebani pengunjung halaman lain.
 */
/** Di bawah zoom ini penanda ODP saling menumpuk dan tidak terbaca, jadi tidak dimuat. */
const ZOOM_MINIMAL_ODP = 13;

const OutletMap = dynamic(() => import("@/components/mitra/outlet-map"), {
    ssr: false,
    loading: () => (
        <div className="flex h-[360px] w-full items-center justify-center bg-gray-100 text-sm text-muted-foreground sm:h-[460px]">
            Memuat peta...
        </div>
    ),
});

interface PublicOutlet {
    publicToken: string;
    outletCode: string;
    name: string;
    tap: string;
    kabupaten: string;
    kecamatan: string;
    category: string;
    pjpDay: string;
    pjpType: string;
    branding: string;
    photoUrl?: string | null;
}

interface OutletResponse {
    outlets: PublicOutlet[];
    total: number;
    page: number;
    pageCount: number;
    filters: { kabupaten: string[]; tap: string[] };
}

interface MapResponse {
    markers: OutletMarker[];
    totalCocok: number;
    tanpaKoordinat: number;
    dibatasi: boolean;
}

export default function MitraOutletDirectoryPage() {
    const [query, setQuery] = React.useState("");
    const [kabupaten, setKabupaten] = React.useState("");
    const [tap, setTap] = React.useState("");
    const [page, setPage] = React.useState(1);
    const [data, setData] = React.useState<OutletResponse | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [map, setMap] = React.useState<MapResponse | null>(null);
    const [mapError, setMapError] = React.useState(false);
    const [focusedOutlet, setFocusedOutlet] = React.useState<string | null>(null);
    const [streetViewToken, setStreetViewToken] = React.useState<string | null>(null);
    const [streetViewOdp, setStreetViewOdp] = React.useState<OdpMarker | null>(null);
    const [posisiSaya, setPosisiSaya] = React.useState<PosisiPengguna | null>(null);
    const [mencariLokasi, setMencariLokasi] = React.useState(false);
    const [galatLokasi, setGalatLokasi] = React.useState("");
    const [odp, setOdp] = React.useState<OdpMarker[]>([]);
    const [tampilkanOdp, setTampilkanOdp] = React.useState(false);
    const [memuatOdp, setMemuatOdp] = React.useState(false);
    const [odpTerpotong, setOdpTerpotong] = React.useState(false);
    const [zoomPeta, setZoomPeta] = React.useState(11);
    const mapSectionRef = React.useRef<HTMLDivElement>(null);

    /**
     * Dicari dari daftar penanda, bukan disimpan sebagai objek. Dengan begitu panel
     * Street View ikut tertutup sendiri begitu filter berubah dan outletnya tidak lagi
     * termasuk hasil -- tanpa perlu membersihkan state secara manual.
     */
    const streetViewOutlet = React.useMemo(
        () => map?.markers.find((marker) => marker.publicToken === streetViewToken) || null,
        [map, streetViewToken]
    );

    /** Street View publik memakai koordinat saja; status dan kapasitas ODP tetap terkunci. */
    const titikStreetView = React.useMemo(() => {
        if (streetViewOdp) {
            return {
                id: streetViewOdp.id,
                judul: "Titik ODP",
                keterangan: "Lokasi sebaran ODP di sekitar outlet",
                latitude: streetViewOdp.latitude,
                longitude: streetViewOdp.longitude,
            };
        }

        if (streetViewOutlet) {
            return {
                id: streetViewOutlet.publicToken,
                judul: streetViewOutlet.name,
                keterangan: streetViewOutlet.outletCode,
                latitude: streetViewOutlet.latitude,
                longitude: streetViewOutlet.longitude,
            };
        }

        return null;
    }, [streetViewOdp, streetViewOutlet]);

    /**
     * Membaca lokasi perangkat lalu memfokuskan peta ke sana. Memakai pembacaan sekali,
     * bukan watchPosition: pengguna menekan tombolnya untuk melihat sekelilingnya sesaat,
     * dan pemantauan terus-menerus hanya menguras baterai serta membuat peta bergeser
     * sendiri saat sedang dibaca.
     */
    const cariLokasiSaya = React.useCallback(() => {
        if (!navigator.geolocation) {
            setGalatLokasi("Perangkat atau browser ini tidak mendukung deteksi lokasi.");
            return;
        }

        setMencariLokasi(true);
        setGalatLokasi("");

        navigator.geolocation.getCurrentPosition(
            (posisi) => {
                setPosisiSaya({
                    lat: posisi.coords.latitude,
                    lng: posisi.coords.longitude,
                    accuracy: posisi.coords.accuracy,
                    // Stempel waktu memaksa peta terbang ulang walau koordinatnya sama persis.
                    stempel: Date.now(),
                });
                setMencariLokasi(false);
                mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            },
            (error) => {
                setMencariLokasi(false);
                setGalatLokasi(
                    error.code === error.PERMISSION_DENIED
                        ? "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini lalu coba lagi."
                        : "Lokasi tidak terbaca. Pastikan GPS aktif lalu coba lagi."
                );
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
    }, []);

    /**
     * Outlet terdekat dihitung dari penanda yang SEDANG tampil, jadi filter kabupaten/TAP
     * di atas ikut berlaku. Dengan begitu "outlet di sekitar saya" bisa dipersempit,
     * misalnya hanya outlet TAP tertentu yang paling dekat dari posisi sekarang.
     */
    const outletTerdekat = React.useMemo(() => {
        if (!posisiSaya || !map?.markers?.length) return [];

        return map.markers
            .map((marker) => ({
                marker,
                jarak: jarakMeter(posisiSaya.lat, posisiSaya.lng, marker.latitude, marker.longitude),
            }))
            .sort((a, b) => a.jarak - b.jarak)
            .slice(0, 5);
    }, [posisiSaya, map]);

    /**
     * Titik ODP berjumlah puluhan ribu, dan Leaflet menggambar tiap penanda sebagai elemen
     * DOM tersendiri -- memuat semuanya membekukan browser. Karena itu yang diambil hanya
     * yang berada di dalam area peta yang sedang terlihat, dan hanya setelah peta cukup
     * diperbesar. Pada tampilan seluruh Jawa Barat, ribuan titik yang saling menumpuk
     * juga tidak memberi informasi apa pun.
     */
    const alihkanOdp = React.useCallback(() => {
        setTampilkanOdp((sebelumnya) => !sebelumnya);
    }, []);

    const muatOdp = React.useCallback(async (bbox: string, zoom: number) => {
        if (!tampilkanOdp) return;

        if (zoom < ZOOM_MINIMAL_ODP) {
            setOdp([]);
            setOdpTerpotong(false);
            return;
        }

        setMemuatOdp(true);
        try {
            const params = new URLSearchParams({ bbox });
            if (kabupaten) params.set("kabupaten", kabupaten);

            const res = await fetch(`/api/public/indihome/odp?${params}`);
            const data = res.ok ? await res.json() : null;
            setOdp(Array.isArray(data?.odp) ? data.odp : []);
            setOdpTerpotong(Boolean(data?.dibatasi));
        } catch {
            setOdp([]);
        } finally {
            setMemuatOdp(false);
        }
    }, [tampilkanOdp, kabupaten]);

    const areaBerubah = React.useCallback((bbox: string, zoom: number) => {
        setZoomPeta(zoom);
        muatOdp(bbox, zoom);
    }, [muatOdp]);

    /** Klik outlet card → scroll ke peta, fokuskan marker-nya, dan buka Street View. */
    const handleFocusOutlet = React.useCallback((publicToken: string) => {
        // Cek apakah outlet ini ada di peta (punya koordinat)
        const hasMarker = map?.markers.some((m) => m.publicToken === publicToken);
        if (!hasMarker) return;

        setFocusedOutlet(publicToken);
        if (STREET_VIEW_ENABLED) {
            setStreetViewOdp(null);
            setStreetViewToken(publicToken);
        }
        mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [map]);

    React.useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ page: String(page), pageSize: "24" });
            if (query.trim()) params.set("q", query.trim());
            if (kabupaten) params.set("kabupaten", kabupaten);
            if (tap) params.set("tap", tap);

            setLoading(true);
            setError("");
            fetch(`/api/public/mitra/outlets?${params}`, { signal: controller.signal })
                .then(async (response) => {
                    if (!response.ok) throw new Error("Daftar outlet belum dapat dimuat");
                    return response.json() as Promise<OutletResponse>;
                })
                .then(setData)
                .catch((fetchError) => {
                    if (fetchError.name !== "AbortError") setError("Daftar Mitra Outlet sedang tidak tersedia. Silakan coba kembali.");
                })
                .finally(() => setLoading(false));
        }, 300);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [kabupaten, page, query, tap]);

    /**
     * Penanda peta diambil terpisah dari daftar dan sengaja TIDAK bergantung pada `page`.
     * Daftar berhalaman 24 baris, sementara peta harus menampilkan seluruh outlet yang
     * cocok dengan filter -- kalau ikut halaman, penandanya akan berpindah-pindah setiap
     * kali pengguna menekan "berikutnya".
     */
    React.useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ view: "map" });
            if (query.trim()) params.set("q", query.trim());
            if (kabupaten) params.set("kabupaten", kabupaten);
            if (tap) params.set("tap", tap);

            setMapError(false);
            fetch(`/api/public/mitra/outlets?${params}`, { signal: controller.signal })
                .then(async (response) => {
                    if (!response.ok) throw new Error("gagal");
                    return response.json() as Promise<MapResponse>;
                })
                .then(setMap)
                .catch((fetchError) => {
                    // Peta bersifat pelengkap; kegagalannya tidak boleh menjatuhkan daftar.
                    if (fetchError.name !== "AbortError") setMapError(true);
                });
        }, 300);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [kabupaten, query, tap]);

    const resetFilters = () => {
        setQuery("");
        setKabupaten("");
        setTap("");
        setPage(1);
    };

    return (
        <main className="min-h-screen bg-gray-50">
            <section className="border-b bg-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-9 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
                    <div>
                        <p className="text-sm font-bold uppercase text-red-600">Direktori Mitra</p>
                        <h1 className="mt-2 text-3xl font-extrabold text-gray-950 md:text-4xl">Mitra Outlet ABK Ciraya</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Temukan outlet berdasarkan nama, wilayah, atau TAP dan buka profil outlet melalui QR.
                        </p>
                    </div>
                    <QrOutletScanner />
                </div>
            </section>

            <section className="border-b bg-white">
                <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:px-6 md:grid-cols-[minmax(240px,1fr)_220px_220px_auto] lg:px-8">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Cari nama, kode, kecamatan, atau TAP" className="pl-9" aria-label="Cari Mitra Outlet" />
                    </div>
                    <select value={kabupaten} onChange={(event) => { setKabupaten(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border bg-white px-3 text-sm" aria-label="Filter Kabupaten">
                        <option value="">Semua Kabupaten</option>
                        {(data?.filters.kabupaten || []).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <select value={tap} onChange={(event) => { setTap(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border bg-white px-3 text-sm" aria-label="Filter TAP">
                        <option value="">Semua TAP</option>
                        {(data?.filters.tap || []).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <Button type="button" variant="outline" onClick={resetFilters}>Reset</Button>
                </div>
            </section>

            {/* Peta dan Street View berbagi baris begitu panorama dibuka; selama tertutup,
                peta memakai lebar penuh seperti sebelumnya. */}
            <section ref={mapSectionRef} className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
                <div className={`grid gap-4 ${titikStreetView ? "lg:grid-cols-2" : ""}`}>
                    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
                            <div>
                                <h2 className="text-sm font-bold text-gray-950">Peta Sebaran Outlet</h2>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Mengikuti filter di atas. Klik penanda atau outlet di bawah untuk fokus di peta
                                    {STREET_VIEW_ENABLED ? " sekaligus membuka Street View." : "."}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={cariLokasiSaya}
                                    disabled={mencariLokasi}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {mencariLokasi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                                    {mencariLokasi ? "Mencari..." : "Lokasi Saya"}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={tampilkanOdp ? "default" : "outline"}
                                    onClick={alihkanOdp}
                                    disabled={memuatOdp}
                                >
                                    {memuatOdp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Router className="h-4 w-4" />}
                                    {memuatOdp ? "Memuat ODP..." : tampilkanOdp ? "Sembunyikan ODP" : "Tampilkan ODP"}
                                </Button>
                                {posisiSaya && (
                                    <button
                                        type="button"
                                        onClick={() => { setPosisiSaya(null); setGalatLokasi(""); }}
                                        className="text-xs font-semibold text-muted-foreground transition-colors hover:text-gray-950"
                                    >
                                        Sembunyikan lokasi saya
                                    </button>
                                )}
                            </div>

                            {map && (
                                <div className="flex items-center gap-3">
                                    {focusedOutlet && (
                                        <button type="button" onClick={() => setFocusedOutlet(null)} className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors">
                                            Reset Fokus
                                        </button>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        <span className="font-bold text-gray-950">{map.markers.length}</span> outlet berkoordinat
                                        {map.tanpaKoordinat > 0 && `, ${map.tanpaKoordinat} belum punya titik lokasi`}
                                    </p>
                                </div>
                            )}
                        </div>

                        {tampilkanOdp && (
                            <div className="border-b bg-gray-50 px-5 py-3">
                                <span className="text-xs text-muted-foreground">
                                    {zoomPeta < ZOOM_MINIMAL_ODP
                                        ? "Perbesar peta untuk menampilkan titik ODP"
                                        : `${odp.length.toLocaleString("id-ID")} titik pada area ini${odpTerpotong ? " (sebagian, perbesar lagi untuk melihat sisanya)" : ""}`}
                                </span>
                            </div>
                        )}

                        {galatLokasi && (
                            <p className="border-b bg-red-50 px-5 py-3 text-sm text-red-700">{galatLokasi}</p>
                        )}

                        {outletTerdekat.length > 0 && (
                            <div className="border-b bg-blue-50/40 px-5 py-4">
                                <div className="flex items-center gap-2">
                                    <Navigation className="h-4 w-4 text-blue-600" />
                                    <h3 className="text-sm font-bold text-gray-950">Outlet di Sekitar Saya</h3>
                                    <span className="text-xs text-muted-foreground">
                                        ketelitian sekitar {Math.round(posisiSaya?.accuracy || 0)} m
                                    </span>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {outletTerdekat.map(({ marker, jarak }) => (
                                        <button
                                            key={marker.publicToken}
                                            type="button"
                                            onClick={() => handleFocusOutlet(marker.publicToken)}
                                            className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-left transition-colors hover:border-red-200"
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold text-gray-950">{marker.name}</span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {marker.kecamatan}, {marker.kabupaten}
                                                </span>
                                            </span>
                                            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
                                                {formatJarak(jarak)}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                <p className="mt-2 text-xs text-muted-foreground">
                                    Dihitung dari outlet yang sedang tampil, jadi filter di atas ikut berlaku.
                                </p>
                            </div>
                        )}

                        {mapError ? (
                            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                                Peta sedang tidak dapat dimuat. Daftar outlet di bawah tetap bisa digunakan.
                            </div>
                        ) : map && map.markers.length === 0 ? (
                            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                                Belum ada outlet berkoordinat untuk filter ini.
                            </div>
                        ) : map ? (
                            <div className="min-h-[360px] flex-1">
                                <OutletMap
                                    heightClass="h-full"
                                    markers={map.markers}
                                    focusedToken={focusedOutlet}
                                    userPosition={posisiSaya}
                                    odp={tampilkanOdp ? odp : []}
                                    onAreaChange={areaBerubah}
                                    onStreetView={STREET_VIEW_ENABLED ? (token) => {
                                        setStreetViewOdp(null);
                                        setFocusedOutlet(token);
                                        setStreetViewToken(token);
                                    } : undefined}
                                    onOdpStreetView={STREET_VIEW_ENABLED ? (titik) => {
                                        setStreetViewToken(null);
                                        setStreetViewOdp(titik);
                                    } : undefined}
                                />
                            </div>
                        ) : (
                            <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground sm:h-[460px]">
                                Memuat peta...
                            </div>
                        )}
                    </div>

                    {titikStreetView && (
                        <StreetViewPanel
                            titik={titikStreetView}
                            onClose={() => { setStreetViewToken(null); setStreetViewOdp(null); }}
                        />
                    )}
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground"><span className="font-bold text-gray-950">{data?.total || 0}</span> outlet ditemukan</p>
                    {loading && <Loader2 className="h-5 w-5 animate-spin text-red-600" />}
                </div>

                {error ? (
                    <div className="rounded-lg border bg-white px-5 py-12 text-center text-sm text-muted-foreground">{error}</div>
                ) : !loading && data?.outlets.length === 0 ? (
                    <div className="rounded-lg border bg-white px-5 py-12 text-center text-sm text-muted-foreground">Outlet tidak ditemukan untuk filter tersebut.</div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {(data?.outlets || []).map((outlet) => {
                            const isFocused = focusedOutlet === outlet.publicToken;
                            const hasCoord = map?.markers.some((m) => m.publicToken === outlet.publicToken);
                            return (
                            <article
                                key={outlet.publicToken}
                                onClick={() => hasCoord && handleFocusOutlet(outlet.publicToken)}
                                className={`overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-300 ${hasCoord ? "cursor-pointer hover:shadow-md" : ""} ${isFocused ? "ring-2 ring-red-500 ring-offset-2" : ""}`}
                            >
                                <div className="grid grid-cols-[104px_1fr]">
                                    <div className="relative min-h-40 bg-gray-100">
                                        {outlet.photoUrl ? <Image src={outlet.photoUrl} alt={outlet.name} fill sizes="104px" className="object-cover" /> : <div className="flex h-full min-h-40 items-center justify-center text-red-600"><Store className="h-8 w-8" /></div>}
                                    </div>
                                    <div className="min-w-0 p-4">
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="secondary">{outlet.category}</Badge>
                                            {outlet.branding && <Badge variant="outline">{outlet.branding}</Badge>}
                                        </div>
                                        <h2 className="mt-3 truncate font-bold text-gray-950">{outlet.name}</h2>
                                        <p className="text-xs text-muted-foreground">{outlet.outletCode}</p>
                                        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                                            <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {outlet.kecamatan}, {outlet.kabupaten}</p>
                                            <p className="flex items-start gap-2"><Route className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {outlet.tap || "TAP belum diisi"}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between border-t px-4 py-3">
                                    <span className="text-xs text-muted-foreground">PJP {outlet.pjpDay} · {outlet.pjpType}</span>
                                    <span onClick={(e) => e.stopPropagation()} role="presentation">
                                        <Link href={`/mitra/o/${outlet.publicToken}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700">Lihat Profil <ArrowRight className="h-4 w-4" /></Link>
                                    </span>
                                </div>
                            </article>
                            );
                        })}
                    </div>
                )}

                {data && data.pageCount > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-3">
                        <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Sebelumnya</Button>
                        <span className="text-sm text-muted-foreground">Halaman {data.page} dari {data.pageCount}</span>
                        <Button variant="outline" disabled={page >= data.pageCount || loading} onClick={() => setPage((current) => current + 1)}>Berikutnya</Button>
                    </div>
                )}
            </section>
        </main>
    );
}
