"use client";

import React from "react";
import { Download, History, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TombolUrut } from "@/components/ui/sortable-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { urutkanBaris, useUrutTabel } from "@/lib/use-sort";

interface BarisPerubahan {
    id: string;
    createdAt: string;
    jenis: string;
    outletCode: string;
    outletName: string;
    tap: string;
    salesforce: string;
    aktor: string;
    keterangan: string;
    nilaiSebelum: string;
    nilaiSesudah: string;
}

const JENIS = [
    { value: "", label: "Semua jenis" },
    { value: "PHOTO", label: "Foto" },
    { value: "LOCATION", label: "Long-Lat" },
    { value: "BRANDING", label: "Branding" },
];

/** YYYY-MM-DD di zona waktu pengguna, bukan UTC -- toISOString() menggeser tanggal. */
function tanggalLokal(geser = 0): string {
    const hari = new Date();
    hari.setDate(hari.getDate() + geser);
    return `${hari.getFullYear()}-${String(hari.getMonth() + 1).padStart(2, "0")}-${String(hari.getDate()).padStart(2, "0")}`;
}

export function PerubahanPanel() {
    const [rows, setRows] = React.useState<BarisPerubahan[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [terpotong, setTerpotong] = React.useState(false);
    const { urut, gantiUrut } = useUrutTabel<string>("");

    // Default 30 hari terakhir: rentang terbuka pada tabel yang tumbuh tiap kunjungan
    // membuat halaman ini makin lambat tiap bulan tanpa ada yang mengubah apa pun.
    const [filter, setFilter] = React.useState({
        dari: tanggalLokal(-30),
        sampai: tanggalLokal(),
        action: "",
        q: "",
    });

    const kueri = React.useCallback(() => {
        const params = new URLSearchParams();
        if (filter.dari) params.set("dari", filter.dari);
        if (filter.sampai) params.set("sampai", filter.sampai);
        if (filter.action) params.set("action", filter.action);
        if (filter.q) params.set("q", filter.q);
        return params;
    }, [filter]);

    const muat = React.useCallback(() => {
        setLoading(true);
        fetch(`/api/admin/mitra/outlet-edits?${kueri().toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setRows(Array.isArray(data.rows) ? data.rows : []);
                setTerpotong(Boolean(data.truncated));
            })
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    }, [kueri]);

    React.useEffect(() => { muat(); }, [muat]);

    // Unduhan lewat navigasi biasa, bukan fetch + blob: browser yang menangani nama berkas
    // dan progresnya, dan cookie sesi ikut terkirim tanpa penanganan tambahan.
    const unduh = () => {
        const params = kueri();
        params.set("format", "xlsx");
        window.location.href = `/api/admin/mitra/outlet-edits?${params.toString()}`;
    };

    const rowsTampil = urutkanBaris(rows, urut, (row, kolom) => {
        if (kolom === "waktu") return new Date(row.createdAt);
        if (kolom === "outlet") return row.outletName;
        if (kolom === "salesforce") return row.salesforce;
        if (kolom === "jenis") return row.jenis;
        if (kolom === "aktor") return row.aktor;
        return "";
    });

    return (
        <div className="space-y-6">

            <div>
                
                <p className="mt-1 text-sm text-muted-foreground">
                    Foto, titik long-lat, dan branding yang diubah dari Portal Mitra. Dipakai untuk
                    memeriksa kunjungan salesforce dan mengunduh rekapnya.
                </p>
            </div>

            <Card>
                <CardContent className="p-5">
                    <div className="grid gap-3 md:grid-cols-5">
                        <div className="space-y-2">
                            <Label>Dari Tanggal</Label>
                            <Input
                                type="date"
                                value={filter.dari}
                                onChange={(event) => setFilter((prev) => ({ ...prev, dari: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Sampai Tanggal</Label>
                            <Input
                                type="date"
                                value={filter.sampai}
                                onChange={(event) => setFilter((prev) => ({ ...prev, sampai: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Jenis Perubahan</Label>
                            <select
                                value={filter.action}
                                onChange={(event) => setFilter((prev) => ({ ...prev, action: event.target.value }))}
                                className="h-10 w-full rounded-md border px-3 text-sm"
                            >
                                {JENIS.map((jenis) => (
                                    <option key={jenis.value} value={jenis.value}>{jenis.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Cari Outlet</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={filter.q}
                                    onChange={(event) => setFilter((prev) => ({ ...prev, q: event.target.value }))}
                                    placeholder="ID Digipos, nama outlet, atau TAP"
                                />
                                <Button onClick={muat} size="icon" aria-label="Cari">
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            {loading ? "Memuat..." : `${rows.length} perubahan ditampilkan`}
                            {terpotong && " (dibatasi 300 baris terbaru — unduh Excel untuk data lengkap)"}
                        </p>
                        <Button onClick={unduh} variant="outline">
                            <Download className="h-4 w-4" />
                            Download Excel
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="overflow-x-auto p-5">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead><TombolUrut kolom="waktu" label="Waktu" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="outlet" label="Outlet" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="salesforce" label="Salesforce" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="jenis" label="Jenis" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead>Perubahan</TableHead>
                                <TableHead><TombolUrut kolom="aktor" label="Diubah Oleh" urut={urut} onKlik={gantiUrut} /></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : rowsTampil.length ? rowsTampil.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="whitespace-nowrap text-xs">
                                        {new Date(row.createdAt).toLocaleString("id-ID")}
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm font-semibold">{row.outletName}</p>
                                        <p className="text-xs text-muted-foreground">{row.outletCode}{row.tap ? ` · ${row.tap}` : ""}</p>
                                    </TableCell>
                                    <TableCell className="text-sm">{row.salesforce || "-"}</TableCell>
                                    <TableCell className="whitespace-nowrap font-semibold">{row.jenis}</TableCell>
                                    <TableCell className="max-w-md">
                                        <p className="text-sm">{row.keterangan}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {row.nilaiSebelum} → {row.nilaiSesudah}
                                        </p>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-xs">{row.aktor}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        <History className="mx-auto mb-2 h-5 w-5" />
                                        Belum ada perubahan pada rentang ini.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
