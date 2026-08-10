"use client";

import React from "react";
import { Download, Loader2, Pencil, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";

import { BackLink } from "@/components/back-link";
import { OperatorShareChart } from "@/components/mitra/operator-share-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TombolUrut } from "@/components/ui/sortable-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bandingkanNilai, useUrutTabel } from "@/lib/use-sort";
import {
    MITRA_MARKET_SHARE_MERGED_GROUPS,
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
    const [filterKabupaten, setFilterKabupaten] = React.useState("");
    const [filterKecamatan, setFilterKecamatan] = React.useState("");
    const [mengunggah, setMengunggah] = React.useState(false);
    const [hasilUnggah, setHasilUnggah] = React.useState<{ saved: number; errors: { row: number; message: string }[] } | null>(null);
    const { urut, gantiUrut } = useUrutTabel<string>("kecamatan");

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

    const daftarKabupaten = Array.from(new Set(rows.map((row) => row.kabupaten))).sort();
    // Daftar kecamatan menyesuaikan kabupaten yang sedang difilter, sama seperti datalist di formulir.
    const daftarKecamatan = Array.from(new Set(
        rows.filter((row) => !filterKabupaten || row.kabupaten === filterKabupaten).map((row) => row.kecamatan)
    )).sort();

    /**
     * Penyaringan dan pengurutan dilakukan di sisi klien karena seluruh baris memang sudah
     * ada di memori (endpoint membatasi 500 baris). Menambah query per klik kolom hanya
     * akan membuat tabel terasa lebih lambat tanpa manfaat.
     */
    const barisTampil = React.useMemo(() => {
        const disaring = rows
            .filter((row) => !filterKabupaten || row.kabupaten === filterKabupaten)
            .filter((row) => !filterKecamatan || row.kecamatan === filterKecamatan);

        const angka = new Set(MITRA_MARKET_SHARE_OPERATORS.map((operator) => String(operator.key)));

        return [...disaring].sort((a, b) => {
            let nilaiA: unknown;
            let nilaiB: unknown;
            if (urut.kolom === "total") {
                nilaiA = sumShares(a);
                nilaiB = sumShares(b);
            } else if (angka.has(urut.kolom)) {
                nilaiA = Number(a[urut.kolom as MitraMarketShareKey] || 0);
                nilaiB = Number(b[urut.kolom as MitraMarketShareKey] || 0);
            } else {
                nilaiA = a[urut.kolom as keyof MarketShareRow];
                nilaiB = b[urut.kolom as keyof MarketShareRow];
            }
            const selisih = bandingkanNilai(nilaiA, nilaiB);
            return urut.naik ? selisih : -selisih;
        });
    }, [rows, filterKabupaten, filterKecamatan, urut]);

    const ringkasan = React.useMemo(() => {
        if (barisTampil.length === 0) return null;

        const rataOperator = MITRA_MARKET_SHARE_OPERATORS.map((operator) => ({
            ...operator,
            rata: barisTampil.reduce((jumlah, row) => jumlah + Number(row[operator.key] || 0), 0) / barisTampil.length,
        }));
        const rataGabungan = MITRA_MARKET_SHARE_MERGED_GROUPS.map((group) => ({
            ...group,
            rata: barisTampil.reduce((jumlah, row) => jumlah + group.sumber.reduce((s, key) => s + Number(row[key] || 0), 0), 0) / barisTampil.length,
        }));
        const tertinggi = [...barisTampil].sort((a, b) => Number(b.telkomsel || 0) - Number(a.telkomsel || 0))[0];
        const terendah = [...barisTampil].sort((a, b) => Number(a.telkomsel || 0) - Number(b.telkomsel || 0))[0];

        return { rataOperator, rataGabungan, tertinggi, terendah, jumlah: barisTampil.length };
    }, [barisTampil]);

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

    const unggahBerkas = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setMengunggah(true);
        setHasilUnggah(null);
        const fd = new FormData();
        fd.append("file", file);

        try {
            const res = await fetch("/api/admin/mitra/market-share/import", { method: "POST", body: fd });
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
            <BackLink href="/admin/mitra" label="Kembali ke Database Mitra Outlet" />

            <div>
                <h1 className="text-2xl font-bold">Market Share Kecamatan</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Persentase pangsa pasar operator per kecamatan. Tampil di halaman detail outlet setelah OTP terverifikasi.
                </p>
            </div>

            {ringkasan && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Kecamatan Tercatat</p>
                            <p className="mt-2 text-2xl font-extrabold text-gray-950">{ringkasan.jumlah.toLocaleString("id-ID")}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {filterKecamatan || filterKabupaten
                                    ? [filterKecamatan, filterKabupaten].filter(Boolean).join(", ")
                                    : "Seluruh kabupaten"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Rata-rata Telkomsel</p>
                            <p className="mt-2 text-2xl font-extrabold text-red-600">
                                {(ringkasan.rataOperator[0]?.rata ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Dari kecamatan yang sedang tampil</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Telkomsel Tertinggi</p>
                            <p className="mt-2 truncate text-lg font-extrabold text-gray-950">{ringkasan.tertinggi?.kecamatan}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {Number(ringkasan.tertinggi?.telkomsel || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}% - {ringkasan.tertinggi?.kabupaten}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Telkomsel Terendah</p>
                            <p className="mt-2 truncate text-lg font-extrabold text-gray-950">{ringkasan.terendah?.kecamatan}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {Number(ringkasan.terendah?.telkomsel || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}% - {ringkasan.terendah?.kabupaten}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {ringkasan && (
                <Card>
                    <CardContent className="p-5">
                        <h2 className="font-bold">Rata-rata Pangsa Pasar Operator</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Dari {ringkasan.jumlah.toLocaleString("id-ID")} kecamatan yang sedang tampil
                            {(filterKecamatan || filterKabupaten) && ` · ${[filterKecamatan, filterKabupaten].filter(Boolean).join(", ")}`}
                        </p>
                        <div className="mt-5 grid gap-6 lg:grid-cols-2">
                            <div>
                                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    Sebelum Merger
                                </p>
                                <OperatorShareChart
                                    data={ringkasan.rataOperator.map((operator) => ({
                                        key: operator.key,
                                        label: operator.label,
                                        color: operator.color,
                                        percent: operator.rata,
                                    }))}
                                />
                            </div>
                            <div className="border-t pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    Setelah Merger (XL Smart &amp; IOH)
                                </p>
                                <OperatorShareChart
                                    data={ringkasan.rataGabungan.map((group) => ({
                                        key: group.key,
                                        label: group.label,
                                        color: group.color,
                                        percent: group.rata,
                                    }))}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                        <h2 className="font-bold">Unggah Banyak Sekaligus</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Berkas XLSX atau CSV berkolom kabupaten, kecamatan, dan enam operator. Wilayah yang sudah ada akan diperbarui.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href="/api/admin/mitra/market-share/import"
                            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                        >
                            <Download className="h-4 w-4" />
                            Template
                        </a>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90">
                            {mengunggah ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {mengunggah ? "Memproses..." : "Pilih Berkas"}
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                disabled={mengunggah}
                                onChange={unggahBerkas}
                            />
                        </label>
                    </div>

                    {hasilUnggah && (
                        <div className="w-full space-y-2">
                            <p className={`rounded-lg p-3 text-sm ${hasilUnggah.saved > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                {hasilUnggah.saved} baris tersimpan
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

            <Card ref={formRef} className="scroll-mt-20">
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
                    <div className="mb-4 flex flex-wrap gap-2">
                        <Input
                            value={q}
                            onChange={(event) => setQ(event.target.value)}
                            placeholder="Cari kabupaten atau kecamatan"
                            className="min-w-[200px] flex-1"
                        />
                        <select
                            value={filterKabupaten}
                            onChange={(event) => {
                                const kabupaten = event.target.value;
                                setFilterKabupaten(kabupaten);
                                // Kecamatan yang sedang dipilih bisa jadi tidak ada di kabupaten baru --
                                // reset supaya filter tidak diam-diam menyaring ke hasil kosong.
                                if (filterKecamatan && !rows.some((row) => row.kabupaten === kabupaten && row.kecamatan === filterKecamatan)) {
                                    setFilterKecamatan("");
                                }
                            }}
                            className="h-10 rounded-md border bg-white px-3 text-sm"
                            aria-label="Filter kabupaten"
                        >
                            <option value="">Semua kabupaten</option>
                            {daftarKabupaten.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <select
                            value={filterKecamatan}
                            onChange={(event) => setFilterKecamatan(event.target.value)}
                            className="h-10 rounded-md border bg-white px-3 text-sm"
                            aria-label="Filter kecamatan"
                        >
                            <option value="">Semua kecamatan</option>
                            {daftarKecamatan.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <Button onClick={load} size="icon" aria-label="Cari">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><TombolUrut kolom="kecamatan" label="Kecamatan" urut={urut} onKlik={gantiUrut} /></TableHead>
                                    <TableHead><TombolUrut kolom="kabupaten" label="Kabupaten" urut={urut} onKlik={gantiUrut} /></TableHead>
                                    {MITRA_MARKET_SHARE_OPERATORS.map((operator) => (
                                        <TableHead key={operator.key} className="text-right">
                                            <TombolUrut kolom={operator.key} label={operator.label} urut={urut} onKlik={gantiUrut} kanan />
                                        </TableHead>
                                    ))}
                                    <TableHead className="text-right">
                                        <TombolUrut kolom="total" label="Total" urut={urut} onKlik={gantiUrut} kanan />
                                    </TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                                ) : barisTampil.length ? barisTampil.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="font-semibold">{row.kecamatan}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{row.kabupaten}</TableCell>
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
                                    <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Belum ada data market share.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
