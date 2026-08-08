"use client";

import Link from "next/link";
import React from "react";
import { Activity, Check, Copy, Search, Trophy } from "lucide-react";

import { BackLink } from "@/components/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MetricRow {
    id: string;
    key: string;
    label: string;
    unit: string | null;
    aggregation: "SUM" | "AVG" | "LAST";
    isPublic: boolean;
    jumlahBaris: number;
}

interface ParamRow {
    id: string;
    key: string;
    label: string;
    unit: string | null;
    weight: string;
    aggregation: "SUM" | "AVG" | "LAST";
    jumlahBaris: number;
}

interface ProgramRow {
    id: string;
    name: string;
    slug: string;
    status: string;
    isPublic: boolean;
    params: ParamRow[];
}

const PENJELASAN_AGREGASI: Record<string, string> = {
    SUM: "Nilai seluruh periode dijumlahkan.",
    AVG: "Nilai seluruh periode dirata-ratakan.",
    LAST: "Hanya periode terbaru yang dipakai.",
};

export default function AdminMitraReferensiPage() {
    const [metrics, setMetrics] = React.useState<MetricRow[]>([]);
    const [programs, setPrograms] = React.useState<ProgramRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [q, setQ] = React.useState("");
    const [disalin, setDisalin] = React.useState<string | null>(null);

    React.useEffect(() => {
        fetch("/api/admin/mitra/reference")
            .then((res) => res.json())
            .then((data) => {
                setMetrics(Array.isArray(data.metrics) ? data.metrics : []);
                setPrograms(Array.isArray(data.programs) ? data.programs : []);
            })
            .finally(() => setLoading(false));
    }, []);

    const salin = async (nilai: string) => {
        try {
            await navigator.clipboard.writeText(nilai);
            setDisalin(nilai);
            window.setTimeout(() => setDisalin((current) => (current === nilai ? null : current)), 1500);
        } catch {
            // Clipboard API ditolak (mis. halaman non-HTTPS); key tetap bisa disalin manual.
        }
    };

    const cocok = (teks: string) => teks.toLowerCase().includes(q.trim().toLowerCase());

    const metricTampil = q ? metrics.filter((row) => cocok(row.key) || cocok(row.label)) : metrics;
    const programTampil = q
        ? programs
            .map((program) => ({
                ...program,
                params: program.params.filter((param) => cocok(param.key) || cocok(param.label)),
            }))
            .filter((program) => cocok(program.name) || cocok(program.slug) || program.params.length > 0)
        : programs;

    const KeyChip = ({ nilai }: { nilai: string }) => (
        <button
            type="button"
            onClick={() => salin(nilai)}
            className="inline-flex items-center gap-1.5 rounded-md border bg-gray-50 px-2 py-1 font-mono text-xs font-semibold text-gray-950 transition-colors hover:border-red-300 hover:bg-red-50"
            title="Klik untuk menyalin"
        >
            {nilai}
            {disalin === nilai ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
        </button>
    );

    return (
        <div className="space-y-6">
            <BackLink href="/admin/mitra" label="Kembali ke Database Mitra Outlet" />

            <div>
                <h1 className="text-2xl font-bold">Referensi Key Import</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Daftar nilai yang sah untuk kolom <code className="rounded bg-gray-100 px-1">metricKey</code>,{" "}
                    <code className="rounded bg-gray-100 px-1">programSlug</code>, dan{" "}
                    <code className="rounded bg-gray-100 px-1">paramKey</code> pada berkas import. Klik key untuk menyalinnya.
                </p>
            </div>

            {/* Ditaruh di atas daftar: pertanyaan pertama orang yang membuka halaman ini
                biasanya "kolom ini diisi apa", bukan "key apa saja yang ada". */}
            <Card>
                <CardContent className="p-5">
                    <h2 className="font-bold">Dipakai di Kolom Mana</h2>
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[560px] border-collapse text-sm">
                            <thead>
                                <tr className="border-b text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    <th className="px-3 py-2 text-left">Jenis Import</th>
                                    <th className="px-3 py-2 text-left">Kolom</th>
                                    <th className="px-3 py-2 text-left">Diisi dengan</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b">
                                    <td className="px-3 py-2 font-semibold">Performance</td>
                                    <td className="px-3 py-2"><code className="rounded bg-gray-100 px-1">metricKey</code></td>
                                    <td className="px-3 py-2 text-muted-foreground">Key metric dari daftar Metric di bawah</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="px-3 py-2 font-semibold">Program Score</td>
                                    <td className="px-3 py-2"><code className="rounded bg-gray-100 px-1">programSlug</code></td>
                                    <td className="px-3 py-2 text-muted-foreground">Slug program, bukan namanya</td>
                                </tr>
                                <tr className="border-b last:border-0">
                                    <td className="px-3 py-2 font-semibold">Program Score</td>
                                    <td className="px-3 py-2"><code className="rounded bg-gray-100 px-1">paramKey</code></td>
                                    <td className="px-3 py-2 text-muted-foreground">Key parameter milik program tersebut</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Key harus sama persis, termasuk huruf besar/kecil. Baris dengan key yang tidak dikenal ditolak
                        saat validasi, bukan diam-diam dilewati. Ambil berkas contohnya di{" "}
                        <Link href="/admin/mitra/import" className="font-semibold text-red-600 hover:underline">Upload Data</Link>.
                    </p>
                </CardContent>
            </Card>

            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari key, label, atau nama program" />

            <Card>
                <CardContent className="p-5">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-red-600" />
                        <h2 className="font-bold">Metric Key</h2>
                        <span className="text-xs text-muted-foreground">({metricTampil.length})</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Dikelola di <Link href="/admin/mitra/performance" className="font-semibold text-red-600 hover:underline">Performance</Link>.
                    </p>

                    <div className="mt-4 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Key</TableHead>
                                    <TableHead>Label</TableHead>
                                    <TableHead>Satuan</TableHead>
                                    <TableHead>Agregasi</TableHead>
                                    <TableHead className="text-right">Baris Data</TableHead>
                                    <TableHead>Publik</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                                ) : metricTampil.length ? metricTampil.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell><KeyChip nilai={row.key} /></TableCell>
                                        <TableCell className="font-semibold">{row.label}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{row.unit || "-"}</TableCell>
                                        <TableCell className="text-sm" title={PENJELASAN_AGREGASI[row.aggregation]}>{row.aggregation}</TableCell>
                                        <TableCell className="text-right tabular-nums">{row.jumlahBaris.toLocaleString("id-ID")}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{row.isPublic ? "Ya" : "Tidak"}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">Belum ada metric.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-red-600" />
                        <h2 className="font-bold">Program &amp; Parameter</h2>
                        <span className="text-xs text-muted-foreground">({programTampil.length})</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Dikelola di <Link href="/admin/mitra/program" className="font-semibold text-red-600 hover:underline">Program Mitra Outlet</Link>.
                        Parameter hanya berlaku untuk programnya sendiri -- key yang sama pada program berbeda adalah dua parameter berbeda.
                    </p>

                    {loading ? (
                        <p className="mt-4 text-sm text-muted-foreground">Memuat...</p>
                    ) : programTampil.length === 0 ? (
                        <p className="mt-4 text-sm text-muted-foreground">Belum ada program.</p>
                    ) : (
                        <div className="mt-4 space-y-4">
                            {programTampil.map((program) => (
                                <div key={program.id} className="rounded-lg border bg-gray-50 p-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-gray-950">{program.name}</span>
                                        <KeyChip nilai={program.slug} />
                                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-gray-200">
                                            {program.status}
                                        </span>
                                        {!program.isPublic && (
                                            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-gray-200">
                                                belum publik
                                            </span>
                                        )}
                                    </div>

                                    {program.params.length === 0 ? (
                                        <p className="mt-3 text-sm text-muted-foreground">Program ini belum punya parameter penilaian.</p>
                                    ) : (
                                        <div className="mt-3 overflow-x-auto">
                                            <table className="w-full min-w-[520px] border-collapse text-sm">
                                                <thead>
                                                    <tr className="border-b text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                                        <th className="px-3 py-2 text-left">paramKey</th>
                                                        <th className="px-3 py-2 text-left">Label</th>
                                                        <th className="px-3 py-2 text-left">Satuan</th>
                                                        <th className="px-3 py-2 text-right">Bobot</th>
                                                        <th className="px-3 py-2 text-left">Agregasi</th>
                                                        <th className="px-3 py-2 text-right">Baris Data</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {program.params.map((param) => (
                                                        <tr key={param.id} className="border-b bg-white last:border-0">
                                                            <td className="px-3 py-2"><KeyChip nilai={param.key} /></td>
                                                            <td className="px-3 py-2 font-semibold">{param.label}</td>
                                                            <td className="px-3 py-2 text-muted-foreground">{param.unit || "-"}</td>
                                                            <td className="px-3 py-2 text-right tabular-nums">
                                                                {Number(param.weight).toLocaleString("id-ID", { maximumFractionDigits: 4 })}
                                                            </td>
                                                            <td className="px-3 py-2" title={PENJELASAN_AGREGASI[param.aggregation]}>{param.aggregation}</td>
                                                            <td className="px-3 py-2 text-right tabular-nums">{param.jumlahBaris.toLocaleString("id-ID")}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5">
                    <h2 className="font-bold">Arti Agregasi</h2>
                    <dl className="mt-3 space-y-2 text-sm">
                        {Object.entries(PENJELASAN_AGREGASI).map(([kunci, arti]) => (
                            <div key={kunci} className="flex gap-3">
                                <dt className="w-16 shrink-0 font-mono text-xs font-bold text-gray-950">{kunci}</dt>
                                <dd className="text-muted-foreground">{arti}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Agregasi menentukan cara nilai beberapa periode digabung saat ditampilkan, bukan cara nilai disimpan.
                        Nilai per bulan tetap tersimpan utuh dan bisa ditimpa dengan mengunggah periode yang sama.
                    </p>
                </CardContent>
            </Card>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                Key yang jumlah baris datanya nol biasanya sisa percobaan; aman dihapus dari menu pengelolanya bila memang tidak dipakai.
            </p>
        </div>
    );
}
