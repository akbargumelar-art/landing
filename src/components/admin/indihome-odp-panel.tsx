"use client";

import React from "react";
import { Download, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ODP_CATEGORIES, hitungOccupancy, infoKategori, type OdpCategory } from "@/lib/indihome-odp";

interface OdpRow {
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

const KOSONG = {
    code: "", kabupaten: "", kecamatan: "", latitude: "", longitude: "",
    portTotal: "", portUsed: "", portAvailable: "", category: "",
};

/**
 * Panel pengelolaan titik ODP, dirender sebagai salah satu tab dashboard IndiHome.
 * Dipisah ke komponen sendiri karena isinya -- unggahan berkas, form, dan tabel --
 * terlalu besar untuk ditumpuk langsung di berkas dashboard yang sudah panjang.
 */
export function IndihomeOdpPanel() {
    const [rows, setRows] = React.useState<OdpRow[]>([]);
    const [total, setTotal] = React.useState(0);
    const [q, setQ] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [mengunggah, setMengunggah] = React.useState(false);
    const [hasilUnggah, setHasilUnggah] = React.useState<{ saved: number; errors: { row: number; message: string }[] } | null>(null);
    const [form, setForm] = React.useState(KOSONG);

    const load = React.useCallback(() => {
        setLoading(true);
        fetch(`/api/admin/indihome/odp?q=${encodeURIComponent(q)}`)
            .then((res) => res.json())
            .then((data) => {
                setRows(Array.isArray(data.odp) ? data.odp : []);
                setTotal(data.total || 0);
            })
            .finally(() => setLoading(false));
    }, [q]);

    React.useEffect(() => { load(); }, [load]);

    const simpan = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        const res = await fetch("/api/admin/indihome/odp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        const data = await res.json().catch(() => ({}));
        setSaving(false);
        if (!res.ok) return alert(data.error || "ODP gagal disimpan");
        setForm(KOSONG);
        load();
    };

    const unggah = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setMengunggah(true);
        setHasilUnggah(null);
        const fd = new FormData();
        fd.append("file", file);

        try {
            const res = await fetch("/api/admin/indihome/odp", { method: "POST", body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error || "Berkas gagal diproses");
                setHasilUnggah({ saved: 0, errors: Array.isArray(data.errors) ? data.errors : [] });
                return;
            }
            setHasilUnggah({ saved: data.saved || 0, errors: Array.isArray(data.errors) ? data.errors : [] });
            load();
        } finally {
            setMengunggah(false);
            event.target.value = "";
        }
    };

    const hapus = async (row: OdpRow) => {
        if (!window.confirm(`Hapus ODP ${row.code || row.kecamatan}?`)) return;
        const res = await fetch(`/api/admin/indihome/odp?id=${row.id}`, { method: "DELETE" });
        if (!res.ok) return alert("ODP gagal dihapus");
        load();
    };

    const hapusSemua = async () => {
        // Konfirmasi ganda: unggahan ODP biasanya menimpa seluruh data, dan penghapusan
        // massal tanpa pagar mudah tertekan saat sebenarnya hanya ingin memperbarui.
        if (!window.confirm(`Hapus SELURUH ${total} titik ODP?`)) return;
        if (!window.confirm("Data ODP akan hilang seluruhnya. Lanjutkan?")) return;

        const res = await fetch("/api/admin/indihome/odp?semua=1", { method: "DELETE" });
        if (!res.ok) return alert("Gagal menghapus data ODP");
        load();
    };

    return (
        <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
                Tampil sebagai lapisan pada peta sebaran di halaman Mitra Outlet. Warna penanda mengikuti kategori;
                bila kategori dikosongkan, warnanya diturunkan otomatis dari occupancy.
            </p>

            <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                        <h2 className="font-bold">Unggah Banyak Sekaligus</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            XLSX atau CSV berkolom kabupaten, kecamatan, latitude, longitude, portTotal, portUsed,
                            portAvailable, dan category.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <a href="/api/admin/indihome/odp?template=1" className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
                            <Download className="h-4 w-4" />
                            Template
                        </a>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90">
                            {mengunggah ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {mengunggah ? "Memproses..." : "Pilih Berkas"}
                            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={mengunggah} onChange={unggah} />
                        </label>
                        {total > 0 && (
                            <Button type="button" variant="outline" size="sm" onClick={hapusSemua}>
                                <Trash2 className="h-4 w-4 text-red-600" />
                                Hapus Semua
                            </Button>
                        )}
                    </div>

                    {hasilUnggah && (
                        <div className="w-full space-y-2">
                            <p className={`rounded-lg p-3 text-sm ${hasilUnggah.saved > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                {hasilUnggah.saved} titik tersimpan
                                {hasilUnggah.errors.length > 0 ? `, ${hasilUnggah.errors.length} baris dilewati` : ""}.
                            </p>
                            {hasilUnggah.errors.length > 0 && (
                                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border bg-gray-50 p-3 text-xs text-muted-foreground">
                                    {hasilUnggah.errors.map((kesalahan, index) => (
                                        <li key={`${kesalahan.row}-${index}`}>Baris {kesalahan.row}: {kesalahan.message}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5">
                    <form onSubmit={simpan} className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                        <Isian label="Kode ODP" nilai={form.code} onChange={(v) => setForm((p) => ({ ...p, code: v }))} />
                        <Isian label="Kabupaten" nilai={form.kabupaten} onChange={(v) => setForm((p) => ({ ...p, kabupaten: v }))} />
                        <Isian label="Kecamatan" nilai={form.kecamatan} onChange={(v) => setForm((p) => ({ ...p, kecamatan: v }))} />
                        <Isian label="Latitude" nilai={form.latitude} onChange={(v) => setForm((p) => ({ ...p, latitude: v }))} />
                        <Isian label="Longitude" nilai={form.longitude} onChange={(v) => setForm((p) => ({ ...p, longitude: v }))} />
                        <Isian label="Jumlah Port" nilai={form.portTotal} onChange={(v) => setForm((p) => ({ ...p, portTotal: v }))} />
                        <Isian label="Port Terpakai" nilai={form.portUsed} onChange={(v) => setForm((p) => ({ ...p, portUsed: v }))} />
                        <Isian label="Port Tersedia" nilai={form.portAvailable} onChange={(v) => setForm((p) => ({ ...p, portAvailable: v }))} />
                        <div className="space-y-2">
                            <Label>Kategori</Label>
                            <select
                                value={form.category}
                                onChange={(event) => setForm((p) => ({ ...p, category: event.target.value }))}
                                className="h-10 w-full rounded-md border px-3 text-sm"
                            >
                                <option value="">Otomatis dari occupancy</option>
                                {ODP_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <Button disabled={saving} className="w-full">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Tambah ODP
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5">
                    <div className="mb-4 flex gap-2">
                        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari kode, kabupaten, atau kecamatan" />
                        <Button onClick={load} size="icon" aria-label="Cari">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>

                    <p className="mb-3 text-sm text-muted-foreground">
                        <span className="font-bold text-gray-950">{total.toLocaleString("id-ID")}</span> titik ODP
                        {rows.length < total ? ` (menampilkan ${rows.length} teratas)` : ""}
                    </p>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ODP</TableHead>
                                    <TableHead>Wilayah</TableHead>
                                    <TableHead className="text-right">Port</TableHead>
                                    <TableHead className="text-right">Occupancy</TableHead>
                                    <TableHead>Kategori</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                                ) : rows.length ? rows.map((row) => {
                                    const kategori = infoKategori(row.category, row.portUsed, row.portTotal);
                                    const occupancy = hitungOccupancy(row.portUsed, row.portTotal);
                                    return (
                                        <TableRow key={row.id}>
                                            <TableCell>
                                                <p className="font-semibold">{row.code || "-"}</p>
                                                <p className="font-mono text-xs text-muted-foreground">
                                                    {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-sm">{row.kecamatan}<br /><span className="text-xs text-muted-foreground">{row.kabupaten}</span></TableCell>
                                            <TableCell className="text-right text-sm tabular-nums">
                                                {row.portUsed}/{row.portTotal}
                                                <br /><span className="text-xs text-muted-foreground">{row.portAvailable} tersedia</span>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold tabular-nums">
                                                {occupancy.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                                                    <span className="h-3 w-3 rounded-sm" style={{ background: kategori.color }} />
                                                    {kategori.label}
                                                    {!row.category && <span className="text-muted-foreground">(otomatis)</span>}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <button onClick={() => hapus(row)} className="rounded-md border p-2" aria-label="Hapus ODP">
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Belum ada titik ODP.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function Isian({ label, nilai, onChange }: { label: string; nilai: string; onChange: (nilai: string) => void }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input value={nilai} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}
