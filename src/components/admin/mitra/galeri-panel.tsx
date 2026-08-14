"use client";

import Image from "next/image";
import React from "react";
import { ExternalLink, Images, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pjpDayInJakarta } from "@/lib/mitra-outlet-options";
import { useAdminScope } from "@/lib/use-admin-scope";

interface GalleryPhoto {
    id: string;
    outletId: string;
    outletCode: string;
    outletName: string;
    tap: string;
    kabupaten: string;
    kecamatan: string;
    pjpDay: string;
    salesforceId: string;
    salesforce: string;
    photoSlot: string;
    photoLabel: string;
    photoUrl: string;
    updatedAt: string | null;
}

interface GalleryResponse {
    rows: GalleryPhoto[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
    filters: {
        taps: string[];
        salesforces: { id: string; name: string }[];
        kabupatens: string[];
        kecamatans: string[];
        pjpDays: string[];
        photoSlots: { key: string; label: string }[];
    };
}

const PAGE_SIZE = 24;

/**
 * Petak galeri hanya selebar beberapa ratus piksel, sementara berkas aslinya foto kamera
 * ponsel berukuran ratusan KB sampai beberapa MB. Meminta versi kecil membuat satu halaman
 * galeri berpindah dalam hitungan ratusan KB, bukan puluhan MB -- tanpa itu petaknya
 * bertahan abu-abu lama sekali dan terbaca sebagai foto yang tidak muncul.
 */
function urlKecil(url: string, lebar: number): string {
    if (!url.startsWith("/api/public/uploads/")) return url;
    return `${url}${url.includes("?") ? "&" : "?"}w=${lebar}`;
}

function formatWaktu(value: string | null): string {
    if (!value) return "Tanggal belum tersedia";
    
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            console.warn("Invalid date in gallery:", value);
            return "Tanggal tidak valid";
        }
        return new Intl.DateTimeFormat("id-ID", {
            dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
        }).format(date);
    } catch (err) {
        console.error("Error formatting date in gallery:", value, err);
        return "Tanggal tidak valid";
    }
}

export function GaleriPanel() {
    const scope = useAdminScope();
    const [data, setData] = React.useState<GalleryResponse | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [page, setPage] = React.useState(1);
    const [ulangMuat, setUlangMuat] = React.useState(0);
    const [dipilih, setDipilih] = React.useState<GalleryPhoto | null>(null);
    const [filter, setFilter] = React.useState({
        dari: "",
        sampai: "",
        tap: "",
        pjpDay: "",
        salesforceId: "",
        kabupaten: "",
        kecamatan: "",
        photoSlot: "ALL",
    });
    const [filterReady, setFilterReady] = React.useState(false);
    const filterInitialized = React.useRef(false);

    React.useEffect(() => {
        if (scope.loading || filterInitialized.current) return;
        filterInitialized.current = true;
        setFilter((current) => ({
            ...current,
            pjpDay: scope.role === "SALESFORCE" ? pjpDayInJakarta() : "",
        }));
        setFilterReady(true);
    }, [scope.loading, scope.role]);

    /**
     * Memuat galeri. Beberapa hal disengaja di sini:
     *
     * - Data lama TIDAK dikosongkan saat memuat ulang. Mengosongkannya membuat seluruh grid
     *   berubah jadi kotak abu-abu setiap kali satu filter disentuh, dan itu terbaca sebagai
     *   "gambarnya hilang" padahal hanya sedang menunggu jawaban.
     * - Ada batas waktu. Tanpa itu, request yang menggantung membuat skeleton berputar tanpa
     *   akhir dan tidak ada satu pun keterangan yang bisa dibaca pengguna.
     * - Hasil yang datang terlambat diabaikan lewat penanda permintaan, supaya jawaban filter
     *   lama tidak menimpa tampilan filter yang sedang aktif.
     */
    React.useEffect(() => {
        if (!filterReady) return;

        const controller = new AbortController();
        const batasWaktu = window.setTimeout(() => controller.abort("timeout"), 20_000);
        let dibatalkan = false;

        const timer = window.setTimeout(() => {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
            Object.entries(filter).forEach(([key, value]) => { if (value) params.set(key, value); });

            fetch(`/api/admin/mitra/photo-gallery?${params.toString()}`, { signal: controller.signal })
                .then(async (response) => {
                    const body = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(body.error || "Galeri foto gagal dimuat");
                    return body as GalleryResponse;
                })
                .then((body) => {
                    if (dibatalkan) return;
                    setData(body);
                    if (body.page !== page) setPage(body.page);
                })
                .catch((fetchError) => {
                    if (dibatalkan) return;
                    if (fetchError?.name === "AbortError" || controller.signal.aborted) {
                        // Dibatalkan karena filter berganti: permintaan berikutnya yang menjawab.
                        // Yang perlu dilaporkan hanya pembatalan karena kehabisan waktu.
                        if (controller.signal.reason === "timeout") {
                            setError("Galeri terlalu lama merespons. Coba muat ulang atau persempit filter.");
                            setLoading(false);
                        }
                        return;
                    }

                    setError(fetchError?.message || "Galeri foto gagal dimuat");
                    setLoading(false);
                })
                .then(() => {
                    if (!dibatalkan && !controller.signal.aborted) setLoading(false);
                });
        }, 250);

        return () => {
            dibatalkan = true;
            window.clearTimeout(timer);
            window.clearTimeout(batasWaktu);
            controller.abort();
        };
    }, [filter, filterReady, page, ulangMuat]);

    const ubahFilter = (key: keyof typeof filter, value: string) => {
        setPage(1);
        setFilter((current) => {
            const next = { ...current, [key]: value };

            // Filter wilayah bersarang: mengganti cakupan yang lebih luas membuat pilihan di
            // bawahnya bisa jadi tidak ada lagi di dalamnya. Membiarkannya menempel akan
            // menghasilkan kombinasi mustahil -- galeri kosong tanpa sebab yang terbaca,
            // padahal yang keliru hanyalah sisa pilihan sebelumnya.
            if (key === "tap") {
                next.kabupaten = "";
                next.kecamatan = "";
                next.salesforceId = "";
            }
            if (key === "kabupaten") {
                next.kecamatan = "";
            }

            return next;
        });
    };

    const filterAktif = Boolean(
        filter.dari || filter.sampai || filter.tap || filter.salesforceId
        || filter.kabupaten || filter.kecamatan
        || (filter.photoSlot && filter.photoSlot !== "ALL")
        || (filter.pjpDay && scope.role !== "SALESFORCE"),
    );

    const resetFilter = () => {
        setPage(1);
        setFilter({
            dari: "",
            sampai: "",
            tap: "",
            pjpDay: scope.role === "SALESFORCE" ? pjpDayInJakarta() : "",
            salesforceId: "",
            kabupaten: "",
            kecamatan: "",
            photoSlot: "ALL",
        });
    };

    /**
     * Dropdown disembunyikan saat tidak ada yang bisa dipilih, TETAPI tetap ditampilkan
     * selama filternya masih terisi. Tanpa syarat kedua, memilih satu nilai bisa membuat
     * opsi tersisa satu -- dropdownnya lenyap sementara filternya masih bekerja, dan
     * pengguna kehilangan satu-satunya cara membatalkannya. Galeri lalu tampak kosong
     * tanpa kendali yang menjelaskannya.
     */
    const tampilFilterTap = scope.role !== "SALESFORCE"
        && ((data?.filters.taps.length || 0) > 1 || Boolean(filter.tap));
    const tampilFilterSalesforce = scope.role !== "SALESFORCE"
        && ((data?.filters.salesforces.length || 0) > 1 || Boolean(filter.salesforceId));
    const tampilFilterKabupaten = (data?.filters.kabupatens.length || 0) > 1 || Boolean(filter.kabupaten);
    const tampilFilterKecamatan = (data?.filters.kecamatans.length || 0) > 1 || Boolean(filter.kecamatan);

    return (
        <div className="space-y-6">

            <div>
                
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                    Semua foto outlet dalam bentuk galeri, tanpa status kepatuhan -- untuk itu buka Monitoring Foto.
                    Gunakan filter yang tersedia untuk menelusuri foto berdasarkan tanggal unggah, jadwal PJP,
                    atau cakupan wilayah akun Anda.
                </p>
            </div>

            <Card>
                <CardContent className="p-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                            <Label>Dari Tanggal</Label>
                            <Input type="date" value={filter.dari} onChange={(event) => ubahFilter("dari", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Sampai Tanggal</Label>
                            <Input type="date" value={filter.sampai} onChange={(event) => ubahFilter("sampai", event.target.value)} />
                        </div>
                        <FilterSelect label="Kategori Foto" value={filter.photoSlot} onChange={(value) => ubahFilter("photoSlot", value)}>
                            <option value="ALL">Semua kategori foto</option>
                            {(data?.filters.photoSlots || []).map((slot) => <option key={slot.key} value={slot.key}>{slot.label}</option>)}
                        </FilterSelect>
                        {tampilFilterTap && <FilterSelect label="TAP" value={filter.tap} onChange={(value) => ubahFilter("tap", value)}>
                            <option value="">Semua TAP</option>
                            {(data?.filters.taps || []).map((item) => <option key={item} value={item}>{item}</option>)}
                        </FilterSelect>}
                        <FilterSelect label="Hari PJP" value={filter.pjpDay} onChange={(value) => ubahFilter("pjpDay", value)}>
                            <option value="">Semua hari</option>
                            {(data?.filters.pjpDays || []).map((item) => <option key={item} value={item}>{item}</option>)}
                        </FilterSelect>
                        {tampilFilterSalesforce && <FilterSelect label="Salesforce" value={filter.salesforceId} onChange={(value) => ubahFilter("salesforceId", value)}>
                            <option value="">Semua Salesforce</option>
                            {(data?.filters.salesforces || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </FilterSelect>}
                        {tampilFilterKabupaten && <FilterSelect label="Kabupaten" value={filter.kabupaten} onChange={(value) => ubahFilter("kabupaten", value)}>
                            <option value="">Semua kabupaten</option>
                            {(data?.filters.kabupatens || []).map((item) => <option key={item} value={item}>{item}</option>)}
                        </FilterSelect>}
                        {tampilFilterKecamatan && <FilterSelect label="Kecamatan" value={filter.kecamatan} onChange={(value) => ubahFilter("kecamatan", value)}>
                            <option value="">Semua kecamatan</option>
                            {(data?.filters.kecamatans || []).map((item) => <option key={item} value={item}>{item}</option>)}
                        </FilterSelect>}
                        {scope.role === "SALESFORCE" && filter.pjpDay === pjpDayInJakarta() && (
                            <p className="self-end rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                                PJP hari ini aktif otomatis
                            </p>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            {loading && !data ? "Memuat galeri..." : `${(data?.total ?? 0).toLocaleString("id-ID")} foto ditemukan`}
                        </p>
                        {filterAktif && (
                            <Button variant="outline" size="sm" onClick={resetFilter} disabled={loading}>
                                Reset filter
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {error && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <span>{error}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUlangMuat((n) => n + 1)}
                        className="border-red-300 bg-white text-red-700 hover:bg-red-100"
                    >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Coba lagi
                    </Button>
                </div>
            )}

            {/*
              * Skeleton hanya untuk pemuatan pertama, saat memang belum ada apa pun yang bisa
              * ditampilkan. Untuk pemuatan berikutnya, foto yang sudah ada dibiarkan terlihat dan
              * hanya diredupkan di balik penanda proses -- mengganti grid berisi dengan kotak abu-abu
              * setiap kali satu filter disentuh membuatnya terbaca sebagai foto yang hilang.
              */}
            {loading && !data ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                    {Array.from({ length: 12 }).map((_, index) => (
                        <div key={index} className="aspect-[4/3] animate-pulse rounded-lg bg-gray-100" />
                    ))}
                </div>
            ) : data?.rows.length ? (
                <div className="relative">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-white/60 backdrop-blur-[1px]">
                            <span className="mt-6 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm">
                                <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                                Menerapkan filter...
                            </span>
                        </div>
                    )}
                    <div
                        className={`grid gap-3 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 ${loading ? "opacity-40" : "opacity-100"}`}
                    >
                        {data.rows.map((foto) => (
                            <button
                                type="button"
                                key={foto.id}
                                onClick={() => setDipilih(foto)}
                                className="group overflow-hidden rounded-lg border bg-white text-left transition hover:border-red-200 hover:shadow-md"
                            >
                                <div className="relative aspect-[4/3] bg-gray-100">
                                    <Image
                                        src={urlKecil(foto.photoUrl, 320)}
                                        alt={`${foto.photoLabel} ${foto.outletName}`}
                                        fill
                                        sizes="(max-width: 640px) 50vw, 16vw"
                                        className="object-cover transition-transform duration-200 group-hover:scale-105"
                                        unoptimized
                                    />
                                    <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white">
                                        {foto.photoLabel}
                                    </span>
                                </div>
                                <div className="p-2.5">
                                    <p className="truncate text-xs font-bold text-gray-950">{foto.outletName}</p>
                                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                        {foto.outletCode}{foto.tap ? ` · ${foto.tap}` : ""}
                                    </p>
                                    <p className="mt-1 text-[10px] text-muted-foreground">{formatWaktu(foto.updatedAt)}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-16 text-center text-sm text-muted-foreground">
                    <Images className="mx-auto mb-2 h-6 w-6" />
                    <p>Tidak ada foto yang cocok dengan filter.</p>
                    {filterAktif && (
                        <div className="mt-3">
                            <Button variant="outline" size="sm" onClick={resetFilter}>Reset filter</Button>
                        </div>
                    )}
                </div>
            )}

            {(data?.pageCount || 1) > 1 && (
                <div className="flex items-center justify-between gap-3">
                    <Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>Sebelumnya</Button>
                    <p className="text-sm text-muted-foreground">Halaman {data?.page || page} dari {data?.pageCount || 1}</p>
                    <Button variant="outline" disabled={loading || page >= (data?.pageCount || 1)} onClick={() => setPage((current) => current + 1)}>Berikutnya</Button>
                </div>
            )}

            <Dialog open={Boolean(dipilih)} onOpenChange={(open) => { if (!open) setDipilih(null); }}>
                <DialogContent className="max-w-2xl">
                    {dipilih && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{dipilih.photoLabel} · {dipilih.outletName}</DialogTitle>
                            </DialogHeader>
                            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-gray-100">
                                <Image
                                    src={urlKecil(dipilih.photoUrl, 960)}
                                    alt={`${dipilih.photoLabel} ${dipilih.outletName}`}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 640px"
                                    className="object-contain"
                                    unoptimized
                                />
                            </div>
                            <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                                <p><span className="font-semibold text-gray-950">Outlet:</span> {dipilih.outletCode}</p>
                                <p><span className="font-semibold text-gray-950">TAP:</span> {dipilih.tap || "-"}</p>
                                <p><span className="font-semibold text-gray-950">Wilayah:</span> {dipilih.kecamatan || "-"}, {dipilih.kabupaten || "-"}</p>
                                <p><span className="font-semibold text-gray-950">Salesforce:</span> {dipilih.salesforce || "-"}</p>
                                <p className="sm:col-span-2"><span className="font-semibold text-gray-950">Diperbarui:</span> {formatWaktu(dipilih.updatedAt)}</p>
                            </div>
                            <a
                                href={dipilih.photoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline"
                            >
                                Buka ukuran penuh di tab baru <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    children,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                {children}
            </select>
        </div>
    );
}
