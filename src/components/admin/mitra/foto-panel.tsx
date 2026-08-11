"use client";

import Image from "next/image";
import React from "react";
import { Camera, ChevronDown, ChevronUp, Download, ExternalLink, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TombolUrut } from "@/components/ui/sortable-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MITRA_PHOTO_SLOTS } from "@/lib/mitra-outlet-photos";
import { PJP_DAYS, pjpDayInJakarta } from "@/lib/mitra-outlet-options";
import { urutkanBaris, useUrutTabel } from "@/lib/use-sort";
import { useAdminScope } from "@/lib/use-admin-scope";

interface PhotoRow {
    id: string;
    outletId: string;
    outletCode: string;
    outletName: string;
    outletCategory: string;
    tap: string;
    kabupaten: string;
    kecamatan: string;
    salesforce: string;
    photoSlot: string;
    photoLabel: string;
    photoUrl: string;
    updatedAt: string | null;
    statusKey: "MISSING" | "STALE" | "FRESH";
    statusLabel: string;
    ageDays: number | null;
}

interface SlotSummary {
    label: string;
    total: number;
    missing: number;
    stale: number;
    fresh: number;
    withPhoto: number;
    percentage: number;
}

interface ReportResponse {
    rows: PhotoRow[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
    summary: Record<string, SlotSummary>;
    filters: {
        categories: string[];
        taps: string[];
        salesforces: { id: string; name: string }[];
    };
    staleAfterDays: number;
    exportTruncated: boolean;
}

const KONDISI = [
    { value: "MISSING", label: "Belum ada foto" },
    { value: "AVAILABLE", label: "Sudah ada foto" },
    { value: "NEEDS_UPDATE", label: "Belum ada atau kedaluwarsa" },
    { value: "STALE", label: "Kedaluwarsa" },
    { value: "FRESH", label: "Terbaru" },
    { value: "ALL", label: "Semua kondisi" },
];

function formatWaktu(value: string | null): string {
    if (!value) return "Belum pernah";
    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
    }).format(new Date(value));
}

function statusClass(status: PhotoRow["statusKey"]): string {
    if (status === "MISSING") return "bg-red-100 text-red-700";
    if (status === "STALE") return "bg-amber-100 text-amber-800";
    return "bg-green-100 text-green-700";
}

// Persentase mengikuti data yang sama dengan tabel di bawahnya (filter kategori/TAP/
// salesforce/PJP/pencarian), jadi kartu ini selalu selaras dengan apa yang sedang dilihat.
function persenClass(percentage: number): string {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 50) return "text-amber-600";
    return "text-red-600";
}

export function FotoPanel() {
    const scope = useAdminScope();
    const [data, setData] = React.useState<ReportResponse | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [page, setPage] = React.useState(1);
    // Beberapa baris boleh terbuka sekaligus -- membandingkan dua foto berdampingan lebih
    // berguna daripada memaksa hanya satu yang boleh mekar dalam satu waktu.
    const [barisMekar, setBarisMekar] = React.useState<Set<string>>(new Set());
    const { urut, gantiUrut } = useUrutTabel<string>("");
    const [filter, setFilter] = React.useState({
        q: "",
        photoSlot: "ALL",
        condition: "MISSING",
        outletCategory: "",
        tap: "",
        salesforceId: "",
        pjpDay: "",
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

    const buatParams = React.useCallback((includePage = true) => {
        const params = new URLSearchParams({
            photoSlot: filter.photoSlot,
            condition: filter.condition,
            pageSize: "50",
        });
        if (includePage) params.set("page", String(page));
        if (filter.q.trim()) params.set("q", filter.q.trim());
        if (filter.outletCategory) params.set("outletCategory", filter.outletCategory);
        if (filter.tap) params.set("tap", filter.tap);
        if (filter.salesforceId) params.set("salesforceId", filter.salesforceId);
        if (filter.pjpDay) params.set("pjpDay", filter.pjpDay);
        return params;
    }, [filter, page]);

    React.useEffect(() => {
        if (!filterReady) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setLoading(true);
            setError("");
            fetch(`/api/admin/mitra/photo-monitoring?${buatParams().toString()}`, { signal: controller.signal })
                .then(async (response) => {
                    const body = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(body.error || "Laporan foto gagal dimuat");
                    return body as ReportResponse;
                })
                .then((body) => {
                    setData(body);
                    if (body.page !== page) setPage(body.page);
                    // Baris mekar milik id di halaman lama; menyimpannya lewat pergantian
                    // filter/halaman cuma menyisakan state yang tidak berpasangan dengan baris apa pun.
                    setBarisMekar(new Set());
                })
                .catch((fetchError) => {
                    if (fetchError.name !== "AbortError") {
                        setData(null);
                        setError(fetchError.message || "Laporan foto gagal dimuat");
                    }
                })
                .finally(() => setLoading(false));
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [buatParams, filterReady, page]);

    const ubahFilter = (key: keyof typeof filter, value: string) => {
        setPage(1);
        setFilter((current) => ({ ...current, [key]: value }));
    };

    const pilihRingkasan = (slot: string) => {
        setPage(1);
        setFilter((current) => ({ ...current, photoSlot: slot, condition: "MISSING" }));
    };

    const alihkanBaris = (id: string) => {
        setBarisMekar((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const unduh = () => {
        const params = buatParams(false);
        params.set("format", "xlsx");
        window.location.href = `/api/admin/mitra/photo-monitoring?${params.toString()}`;
    };

    // Sort hanya mengurutkan ulang baris yang sedang dimuat di halaman ini -- data sudah
    // dipaginasi server-side, jadi klik kolom tidak memicu request baru.
    const barisTampil = React.useMemo(() => {
        if (!data?.rows.length) return [];
        return urutkanBaris(data.rows, urut, (row, kolom) => {
            if (kolom === "outlet") return row.outletName;
            if (kolom === "kategori") return row.photoLabel;
            if (kolom === "status") return row.statusKey;
            if (kolom === "updatedAt") return row.updatedAt ? new Date(row.updatedAt) : null;
            if (kolom === "tap") return row.tap;
            if (kolom === "wilayah") return row.kecamatan;
            return "";
        });
    }, [data, urut]);

    const tampilFilterTap = scope.role !== "SALESFORCE"
        && (data?.filters.taps.length || 0) > 1;
    const tampilFilterSalesforce = scope.role !== "SALESFORCE"
        && (data?.filters.salesforces.length || 0) > 1;

    return (
        <div className="space-y-6">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    
                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                        Satu baris mewakili satu kategori foto pada satu outlet. Gunakan filter untuk menemukan foto
                        yang belum ada atau belum diperbarui sesuai jadwal kunjungan. Persentase pada kartu ringkasan
                        dan angka di bawahnya mengikuti filter yang sedang aktif.
                    </p>
                </div>
                <Button variant="outline" onClick={unduh} disabled={loading || !data}>
                    <Download className="h-4 w-4" />
                    Download Excel
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {MITRA_PHOTO_SLOTS.map((slot) => {
                    const summary = data?.summary?.[slot.key];
                    const aktif = filter.photoSlot === slot.key && filter.condition === "MISSING";
                    return (
                        <button
                            type="button"
                            key={slot.key}
                            onClick={() => pilihRingkasan(slot.key)}
                            className={`rounded-lg border bg-white p-4 text-left shadow-sm transition-colors hover:border-red-300 ${aktif ? "border-red-400 ring-2 ring-red-100" : ""}`}
                        >
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{slot.label}</p>
                            <p className={`mt-2 text-2xl font-extrabold ${persenClass(summary?.percentage ?? 0)}`}>
                                {summary?.percentage ?? 0}%
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {summary?.withPhoto ?? 0} dari {summary?.total ?? 0} outlet sudah berfoto ·{" "}
                                {summary?.missing ?? 0} belum ada · {summary?.stale ?? 0} kedaluwarsa
                            </p>
                        </button>
                    );
                })}
            </div>

            <Card>
                <CardContent className="p-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2 xl:col-span-2">
                            <Label>Cari Outlet</Label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={filter.q}
                                    onChange={(event) => ubahFilter("q", event.target.value)}
                                    placeholder="ID Digipos, nama, wilayah, TAP"
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <FilterSelect label="Kategori Foto" value={filter.photoSlot} onChange={(value) => ubahFilter("photoSlot", value)}>
                            <option value="ALL">Semua kategori foto</option>
                            {MITRA_PHOTO_SLOTS.map((slot) => <option key={slot.key} value={slot.key}>{slot.label}</option>)}
                        </FilterSelect>
                        <FilterSelect label="Kondisi" value={filter.condition} onChange={(value) => ubahFilter("condition", value)}>
                            {KONDISI.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </FilterSelect>
                        <FilterSelect label="Kategori Outlet" value={filter.outletCategory} onChange={(value) => ubahFilter("outletCategory", value)}>
                            <option value="">Semua kategori outlet</option>
                            {(data?.filters.categories || []).map((item) => <option key={item} value={item}>{item}</option>)}
                        </FilterSelect>
                        {tampilFilterTap && <FilterSelect label="TAP" value={filter.tap} onChange={(value) => ubahFilter("tap", value)}>
                            <option value="">Semua TAP</option>
                            {(data?.filters.taps || []).map((item) => <option key={item} value={item}>{item}</option>)}
                        </FilterSelect>}
                        {tampilFilterSalesforce && <FilterSelect label="Salesforce" value={filter.salesforceId} onChange={(value) => ubahFilter("salesforceId", value)}>
                            <option value="">Semua Salesforce</option>
                            {(data?.filters.salesforces || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </FilterSelect>}
                        <FilterSelect label="Hari PJP" value={filter.pjpDay} onChange={(value) => ubahFilter("pjpDay", value)}>
                            <option value="">Semua hari</option>
                            {PJP_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                        </FilterSelect>
                        {scope.role === "SALESFORCE" && filter.pjpDay === pjpDayInJakarta() && (
                            <p className="self-end rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                                PJP hari ini aktif otomatis
                            </p>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <p>
                            {loading ? "Memuat laporan..." : `${data?.total ?? 0} baris ditemukan`}
                            {data && ` · foto dianggap kedaluwarsa setelah ${data.staleAfterDays} hari`}
                        </p>
                        {data?.exportTruncated && <p className="font-semibold text-amber-700">Ekspor dibatasi 20.000 baris.</p>}
                    </div>
                </CardContent>
            </Card>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

            <Card>
                <CardContent className="overflow-x-auto p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead><TombolUrut kolom="outlet" label="Outlet" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="kategori" label="Kategori Foto" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="status" label="Status" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="updatedAt" label="Terakhir Diperbarui" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="tap" label="TAP / Salesforce" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="wilayah" label="Wilayah" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead>Foto</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="h-28 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                            ) : barisTampil.length ? barisTampil.map((row) => {
                                const mekar = barisMekar.has(row.id);
                                return (
                                <React.Fragment key={row.id}>
                                <TableRow
                                    // Baris hanya bisa diklik kalau ada fotonya -- tanpa foto tidak ada
                                    // apa pun yang bisa dimekarkan.
                                    onClick={row.photoUrl ? () => alihkanBaris(row.id) : undefined}
                                    className={row.photoUrl ? "cursor-pointer" : undefined}
                                    aria-expanded={row.photoUrl ? mekar : undefined}
                                >
                                    <TableCell>
                                        <p className="font-semibold text-gray-950">{row.outletName}</p>
                                        <p className="text-xs text-muted-foreground">{row.outletCode} · {row.outletCategory}</p>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap font-semibold">{row.photoLabel}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(row.statusKey)}`}>
                                            {row.statusKey === "STALE" ? "Kedaluwarsa" : row.statusKey === "FRESH" ? "Terbaru" : "Belum Ada"}
                                        </span>
                                        {row.ageDays != null && <p className="mt-1 text-xs text-muted-foreground">{row.ageDays} hari lalu</p>}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">{formatWaktu(row.updatedAt)}</TableCell>
                                    <TableCell>
                                        <p className="text-sm">{row.tap || "-"}</p>
                                        <p className="text-xs text-muted-foreground">{row.salesforce || "Belum ditentukan"}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm">{row.kecamatan || "-"}</p>
                                        <p className="text-xs text-muted-foreground">{row.kabupaten || "-"}</p>
                                    </TableCell>
                                    <TableCell>
                                        {row.photoUrl ? (
                                            <span className="inline-flex items-center gap-2">
                                                <Image
                                                    src={row.photoUrl}
                                                    alt={`${row.outletName} - ${row.photoLabel}`}
                                                    width={40}
                                                    height={40}
                                                    className="h-10 w-10 shrink-0 rounded-md border object-cover"
                                                    unoptimized
                                                />
                                                {mekar
                                                    ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                            </span>
                                        ) : <span className="text-xs text-muted-foreground">-</span>}
                                    </TableCell>
                                </TableRow>
                                {mekar && row.photoUrl && (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={7} className="bg-gray-50/70 p-4">
                                            <div className="flex flex-col items-start gap-4 sm:flex-row">
                                                <Image
                                                    src={row.photoUrl}
                                                    alt={`${row.outletName} - ${row.photoLabel}`}
                                                    width={320}
                                                    height={320}
                                                    className="max-h-80 w-auto max-w-full rounded-lg border bg-white object-contain"
                                                    unoptimized
                                                />
                                                <div className="space-y-1 text-sm">
                                                    <p className="font-semibold text-gray-950">{row.outletName} · {row.photoLabel}</p>
                                                    <p className="text-xs text-muted-foreground">{row.outletCode} · {row.outletCategory}</p>
                                                    <p className="text-xs text-muted-foreground">Diperbarui {formatWaktu(row.updatedAt)}</p>
                                                    <a
                                                        href={row.photoUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={(event) => event.stopPropagation()}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                                                    >
                                                        Buka ukuran penuh di tab baru <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                                </React.Fragment>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                                        <Camera className="mx-auto mb-2 h-5 w-5" />
                                        Tidak ada data yang cocok dengan filter.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {(data?.pageCount || 1) > 1 && (
                <div className="flex items-center justify-between gap-3">
                    <Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>Sebelumnya</Button>
                    <p className="text-sm text-muted-foreground">Halaman {data?.page || page} dari {data?.pageCount || 1}</p>
                    <Button variant="outline" disabled={loading || page >= (data?.pageCount || 1)} onClick={() => setPage((current) => current + 1)}>Berikutnya</Button>
                </div>
            )}
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
