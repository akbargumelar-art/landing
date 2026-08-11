"use client";

import Image from "next/image";
import React from "react";
import { ExternalLink, Images } from "lucide-react";

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

function formatWaktu(value: string | null): string {
    if (!value) return "Tanggal belum tersedia";
    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta",
    }).format(new Date(value));
}

export function GaleriPanel() {
    const scope = useAdminScope();
    const [data, setData] = React.useState<GalleryResponse | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [page, setPage] = React.useState(1);
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

    React.useEffect(() => {
        if (!filterReady) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setLoading(true);
            setError("");
            const params = new URLSearchParams({ page: String(page), pageSize: "60" });
            Object.entries(filter).forEach(([key, value]) => { if (value) params.set(key, value); });

            fetch(`/api/admin/mitra/photo-gallery?${params.toString()}`, { signal: controller.signal })
                .then(async (response) => {
                    const body = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(body.error || "Galeri foto gagal dimuat");
                    return body as GalleryResponse;
                })
                .then((body) => {
                    setData(body);
                    if (body.page !== page) setPage(body.page);
                })
                .catch((fetchError) => {
                    if (fetchError.name !== "AbortError") {
                        setData(null);
                        setError(fetchError.message || "Galeri foto gagal dimuat");
                    }
                })
                .finally(() => setLoading(false));
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [filter, filterReady, page]);

    const ubahFilter = (key: keyof typeof filter, value: string) => {
        setPage(1);
        setFilter((current) => ({ ...current, [key]: value }));
    };

    const tampilFilterTap = scope.role !== "SALESFORCE" && (data?.filters.taps.length || 0) > 1;
    const tampilFilterSalesforce = scope.role !== "SALESFORCE" && (data?.filters.salesforces.length || 0) > 1;
    const tampilFilterKabupaten = (data?.filters.kabupatens.length || 0) > 1;
    const tampilFilterKecamatan = (data?.filters.kecamatans.length || 0) > 1;

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

                    <p className="mt-4 text-sm text-muted-foreground">
                        {loading ? "Memuat galeri..." : `${(data?.total ?? 0).toLocaleString("id-ID")} foto ditemukan`}
                    </p>
                </CardContent>
            </Card>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

            {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                    {Array.from({ length: 12 }).map((_, index) => (
                        <div key={index} className="aspect-[4/3] animate-pulse rounded-lg bg-gray-100" />
                    ))}
                </div>
            ) : data?.rows.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                    {data.rows.map((foto) => (
                        <button
                            type="button"
                            key={foto.id}
                            onClick={() => setDipilih(foto)}
                            className="group overflow-hidden rounded-lg border bg-white text-left transition hover:border-red-200 hover:shadow-md"
                        >
                            <div className="relative aspect-[4/3] bg-gray-100">
                                <Image
                                    src={foto.photoUrl}
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
            ) : (
                <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-16 text-center text-sm text-muted-foreground">
                    <Images className="mx-auto mb-2 h-6 w-6" />
                    Tidak ada foto yang cocok dengan filter.
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
                                    src={dipilih.photoUrl}
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
