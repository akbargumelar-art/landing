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
    expiresAt: string;
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
                    <h1 className="mt-4 text-lg font-bold">Sesi Detail Berakhir</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Silakan verifikasi OTP ulang untuk membuka detail outlet.</p>
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
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-red-600">Detail Terverifikasi</p>
                            <h1 className="mt-1 text-2xl font-extrabold">{data.outlet.name}</h1>
                            <p className="mt-1 text-sm text-muted-foreground">{data.outlet.outletCode} - {data.outlet.ownerName}</p>
                        </div>
                        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                            Sesi berlaku sampai {new Date(data.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </div>
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

                {MITRA_DETAIL_FIELD_GROUPS.map((group) => {
                    const values = data.details[group.key] || {};
                    return (
                        <div key={group.key} className="rounded-lg border bg-white p-5 shadow-sm">
                            <h2 className="font-bold">{group.title}</h2>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {group.fields.map((field) => (
                                    <div key={field.key} className="rounded-lg border bg-gray-50 p-3">
                                        <p className="text-xs text-muted-foreground">{field.label}</p>
                                        <p className="mt-1 text-base font-bold text-gray-950">
                                            {(values[field.key] ?? 0).toLocaleString("id-ID")}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </section>
        </main>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 font-semibold">{value}</p>
        </div>
    );
}
