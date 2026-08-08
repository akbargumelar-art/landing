"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React from "react";
import { ArrowLeft, MapPin, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MITRA_DETAIL_FIELD_GROUPS } from "@/lib/mitra-fields";

interface DetailData {
    outlet: Record<string, string | number | null>;
    details: {
        ownerPhone: string;
        sellthruDigipos: Record<string, number>;
        sellthruNota: Record<string, number>;
        rechargeDigipos: Record<string, number>;
    };
    performance: {
        metricKey: string;
        metricLabel: string;
        unit?: string | null;
        periodYm: string;
        value: string;
    }[];
}

export default function MitraOutletDetailPage() {
    const params = useParams();
    const publicToken = String(params.publicToken || "");
    const [data, setData] = React.useState<DetailData | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetch(`/api/public/mitra/outlets/${publicToken}/detail`)
            .then((res) => res.ok ? res.json() : null)
            .then(setData)
            .finally(() => setLoading(false));
    }, [publicToken]);

    if (loading) {
        return <main className="min-h-screen bg-gray-50 pt-24 text-center text-sm text-muted-foreground">Memuat detail...</main>;
    }

    if (!data) {
        return (
            <main className="min-h-screen bg-gray-50 pt-24">
                <div className="mx-auto max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
                    <ShieldCheck className="mx-auto h-10 w-10 text-red-600" />
                    <h1 className="mt-4 text-lg font-bold">Verifikasi Diperlukan</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Silakan verifikasi OTP WhatsApp untuk membuka detail outlet.</p>
                    <Link href={`/mitra/o/${publicToken}`} className="mt-5 block">
                        <Button>Kembali ke Profil Outlet</Button>
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 pt-20">
            <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                <Link href={`/mitra/o/${publicToken}`} className="inline-flex items-center gap-2 text-sm font-semibold text-red-600">
                    <ArrowLeft className="h-4 w-4" />
                    Profil Outlet
                </Link>

                <div className="rounded-lg border bg-white p-5 shadow-sm">
                    {/* Tidak ada lagi penanda masa berlaku sesi: batas waktu hanya melekat pada
                        kode OTP, sedangkan halaman detail tetap terbuka setelah verifikasi. */}
                    <div>
                        <p className="text-sm font-bold uppercase tracking-widest text-red-600">Detail Terverifikasi</p>
                        <h1 className="mt-1 text-2xl font-extrabold">{data.outlet.name}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{data.outlet.outletCode} - {data.outlet.ownerName}</p>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Info label="Nomor Owner" value={data.details.ownerPhone || "-"} />
                        <Info label="Nomor RS" value={String(data.outlet.rsNumber || "-")} />
                        <Info label="TAP" value={String(data.outlet.tap || "-")} />
                        <Info label="Salesforce" value={String(data.outlet.salesforce || "-")} />
                    </div>

                    {data.outlet.locationUrl && (
                        <a href={String(data.outlet.locationUrl)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600">
                            <MapPin className="h-4 w-4" />
                            Buka lokasi outlet
                        </a>
                    )}
                </div>

                <div className="rounded-lg border bg-white p-5 shadow-sm">
                    <h2 className="font-bold">Riwayat Performance</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {data.performance.length > 0 ? data.performance.map((metric) => (
                            <div key={`${metric.metricKey}-${metric.periodYm}`} className="rounded-lg border bg-gray-50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-xs text-muted-foreground">{metric.metricLabel}</p>
                                    <span className="text-xs font-semibold text-red-600">{metric.periodYm}</span>
                                </div>
                                <p className="mt-1 text-base font-bold text-gray-950">
                                    {Number(metric.value).toLocaleString("id-ID")} {metric.unit || ""}
                                </p>
                            </div>
                        )) : (
                            <p className="text-sm text-muted-foreground">Belum ada data performance.</p>
                        )}
                    </div>
                </div>

                {/* Tiap parameter punya tiga angka (M-1, M, MoM), jadi disajikan sebagai
                    baris tabel. Bentuk kartu sebelumnya memecah satu parameter menjadi tiga
                    kotak terpisah dan sulit dibaca begitu jumlah parameternya puluhan. */}
                {MITRA_DETAIL_FIELD_GROUPS.map((group) => {
                    const values = data.details[group.key] || {};
                    return (
                        <div key={group.key} className="rounded-lg border bg-white p-5 shadow-sm">
                            <h2 className="font-bold">{group.title}</h2>
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full min-w-[520px] border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                            <th className="px-3 py-2 text-left">Parameter</th>
                                            <th className="px-3 py-2 text-right">M-1</th>
                                            <th className="px-3 py-2 text-right">M</th>
                                            <th className="px-3 py-2 text-right">MoM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.rows.map((row) => (
                                            <tr key={row.key} className="border-b last:border-0 odd:bg-gray-50/60">
                                                <td className="px-3 py-2">
                                                    <span className="font-medium text-gray-950">{row.label}</span>
                                                    <span className="ml-2 text-xs text-muted-foreground">{row.unit === "qty" ? "qty" : "rev."}</span>
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">{formatValue(values[row.m1Key])}</td>
                                                <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-950">{formatValue(values[row.mKey])}</td>
                                                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${momClass(values[row.momKey])}`}>
                                                    {formatMoM(values[row.momKey])}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </section>
        </main>
    );
}

function formatValue(value: number | undefined) {
    return (value ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

// MoM disimpan sebagai persentase pertumbuhan, jadi ditampilkan bertanda supaya
// arah naik/turunnya terbaca tanpa harus membandingkan kolom M-1 dan M.
function formatMoM(value: number | undefined) {
    const number = value ?? 0;
    const sign = number > 0 ? "+" : "";
    return `${sign}${number.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function momClass(value: number | undefined) {
    const number = value ?? 0;
    if (number > 0) return "text-green-600";
    if (number < 0) return "text-red-600";
    return "text-muted-foreground";
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 font-semibold">{value}</p>
        </div>
    );
}
