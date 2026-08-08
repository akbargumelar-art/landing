"use client";

import React from "react";
import { Loader2, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    MITRA_MARKET_SHARE_OPERATORS,
    type MitraMarketShareKey,
    sumShares,
} from "@/lib/mitra-market-share";

interface MarketShareRow extends Record<MitraMarketShareKey, string> {
    id: string;
    kabupaten: string;
    kecamatan: string;
}

interface Area {
    kabupaten: string;
    kecamatan: string;
}

const KOSONG = {
    id: "",
    kabupaten: "",
    kecamatan: "",
    ...Object.fromEntries(MITRA_MARKET_SHARE_OPERATORS.map((operator) => [operator.key, ""])),
} as unknown as MarketShareRow;

export default function AdminMitraMarketSharePage() {
    const [rows, setRows] = React.useState<MarketShareRow[]>([]);
    const [areas, setAreas] = React.useState<Area[]>([]);
    const [q, setQ] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [form, setForm] = React.useState<MarketShareRow>(KOSONG);
    // Sama seperti halaman Salesforce: formulirnya di atas, tombol Edit di tabel bawah.
    const formRef = React.useRef<HTMLDivElement>(null);

    const startEdit = (row: MarketShareRow) => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setForm(row);
    };

    const load = React.useCallback(() => {
        setLoading(true);
        fetch(`/api/admin/mitra/market-share?q=${encodeURIComponent(q)}`)
            .then((res) => res.json())
            .then((data) => {
                setRows(Array.isArray(data.marketShares) ? data.marketShares : []);
                setAreas(Array.isArray(data.areas) ? data.areas : []);
            })
            .finally(() => setLoading(false));
    }, [q]);

    React.useEffect(() => { load(); }, [load]);

    const kabupatenOptions = Array.from(new Set(areas.map((area) => area.kabupaten))).sort();
    // Daftar kecamatan menyesuaikan kabupaten yang sedang diketik; kalau belum diisi,
    // seluruh kecamatan ditawarkan.
    const kecamatanOptions = Array.from(new Set(
        areas.filter((area) => !form.kabupaten || area.kabupaten === form.kabupaten).map((area) => area.kecamatan)
    )).sort();

    const total = sumShares(form);

    const updateField = (key: string, value: string) => {
        setForm((previous) => ({ ...previous, [key]: value }));
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        const res = await fetch("/api/admin/mitra/market-share", {
            method: form.id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        const data = await res.json().catch(() => ({}));
        setSaving(false);
        if (!res.ok) return alert(data.error || "Gagal menyimpan market share");
        setForm(KOSONG);
        load();
    };

    const remove = async (row: MarketShareRow) => {
        if (!window.confirm(`Hapus market share ${row.kecamatan}, ${row.kabupaten}?`)) return;
        const res = await fetch(`/api/admin/mitra/market-share?id=${row.id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return alert(data.error || "Gagal menghapus market share");
        }
        if (form.id === row.id) setForm(KOSONG);
        load();
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Market Share Kecamatan</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Persentase pangsa pasar operator per kecamatan. Tampil di halaman detail outlet setelah OTP terverifikasi.
                </p>
            </div>

            <Card ref={formRef}>
                <CardContent className="p-5">
                    <form onSubmit={save} className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Kabupaten</Label>
                                <Input
                                    list="opsi-kabupaten"
                                    value={form.kabupaten}
                                    onChange={(event) => updateField("kabupaten", event.target.value)}
                                    placeholder="Kota Cirebon"
                                />
                                <datalist id="opsi-kabupaten">
                                    {kabupatenOptions.map((item) => <option key={item} value={item} />)}
                                </datalist>
                            </div>
                            <div className="space-y-2">
                                <Label>Kecamatan</Label>
                                <Input
                                    list="opsi-kecamatan"
                                    value={form.kecamatan}
                                    onChange={(event) => updateField("kecamatan", event.target.value)}
                                    placeholder="Kesambi"
                                />
                                <datalist id="opsi-kecamatan">
                                    {kecamatanOptions.map((item) => <option key={item} value={item} />)}
                                </datalist>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {MITRA_MARKET_SHARE_OPERATORS.map((operator) => (
                                <div key={operator.key} className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: operator.color }} />
                                        {operator.label} (%)
                                    </Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step="0.01"
                                        value={form[operator.key] ?? ""}
                                        onChange={(event) => updateField(operator.key, event.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button disabled={saving || !form.kabupaten || !form.kecamatan}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : form.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {form.id ? "Simpan Perubahan" : "Simpan Market Share"}
                            </Button>
                            {form.id && (
                                <Button type="button" variant="ghost" onClick={() => setForm(KOSONG)}>
                                    <X className="h-4 w-4" />
                                    Batal edit
                                </Button>
                            )}
                            {/* Totalnya tidak dipaksa 100: sumber data survei sering menyisakan
                                kategori "lainnya" yang tidak masuk enam operator ini. */}
                            <p className="text-sm text-muted-foreground">
                                Total: <span className="font-semibold text-gray-950">{total.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%</span>
                                {total > 100 && <span className="ml-2 text-red-600">melebihi 100%</span>}
                            </p>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5">
                    <div className="mb-4 flex gap-2">
                        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari kabupaten atau kecamatan" />
                        <Button onClick={load} size="icon" aria-label="Cari">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Wilayah</TableHead>
                                    {MITRA_MARKET_SHARE_OPERATORS.map((operator) => (
                                        <TableHead key={operator.key} className="text-right">{operator.label}</TableHead>
                                    ))}
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                                ) : rows.length ? rows.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            <p className="font-semibold">{row.kecamatan}</p>
                                            <p className="text-xs text-muted-foreground">{row.kabupaten}</p>
                                        </TableCell>
                                        {MITRA_MARKET_SHARE_OPERATORS.map((operator) => (
                                            <TableCell key={operator.key} className="text-right tabular-nums">
                                                {Number(row[operator.key] ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right font-semibold tabular-nums">
                                            {sumShares(row).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => startEdit(row)} className="rounded-md border p-2" title="Edit" aria-label="Edit market share">
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => remove(row)} className="rounded-md border p-2" title="Hapus" aria-label="Hapus market share">
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Belum ada data market share.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
