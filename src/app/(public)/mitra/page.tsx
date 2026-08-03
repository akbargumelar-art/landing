"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";
import { ArrowRight, Loader2, MapPin, Route, Search, Store } from "lucide-react";

import { QrOutletScanner } from "@/components/mitra/qr-outlet-scanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PublicOutlet {
    publicToken: string;
    outletCode: string;
    name: string;
    tap: string;
    kabupaten: string;
    kecamatan: string;
    territoryName?: string | null;
    category: string;
    pjpDay: string;
    pjpType: string;
    branding: string;
    photoUrl?: string | null;
}

interface OutletResponse {
    outlets: PublicOutlet[];
    total: number;
    page: number;
    pageCount: number;
    filters: { kabupaten: string[]; tap: string[] };
}

export default function MitraOutletDirectoryPage() {
    const [query, setQuery] = React.useState("");
    const [kabupaten, setKabupaten] = React.useState("");
    const [tap, setTap] = React.useState("");
    const [page, setPage] = React.useState(1);
    const [data, setData] = React.useState<OutletResponse | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ page: String(page), pageSize: "24" });
            if (query.trim()) params.set("q", query.trim());
            if (kabupaten) params.set("kabupaten", kabupaten);
            if (tap) params.set("tap", tap);

            setLoading(true);
            setError("");
            fetch(`/api/public/mitra/outlets?${params}`, { signal: controller.signal })
                .then(async (response) => {
                    if (!response.ok) throw new Error("Daftar outlet belum dapat dimuat");
                    return response.json() as Promise<OutletResponse>;
                })
                .then(setData)
                .catch((fetchError) => {
                    if (fetchError.name !== "AbortError") setError("Daftar Mitra Outlet sedang tidak tersedia. Silakan coba kembali.");
                })
                .finally(() => setLoading(false));
        }, 300);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [kabupaten, page, query, tap]);

    const resetFilters = () => {
        setQuery("");
        setKabupaten("");
        setTap("");
        setPage(1);
    };

    return (
        <main className="min-h-screen bg-gray-50 pt-20">
            <section className="border-b bg-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-9 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
                    <div>
                        <p className="text-sm font-bold uppercase text-red-600">Direktori Mitra</p>
                        <h1 className="mt-2 text-3xl font-extrabold text-gray-950 md:text-4xl">Mitra Outlet ABK Ciraya</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Temukan outlet berdasarkan nama, wilayah, atau TAP dan buka profil outlet melalui QR.
                        </p>
                    </div>
                    <QrOutletScanner />
                </div>
            </section>

            <section className="border-b bg-white">
                <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:px-6 md:grid-cols-[minmax(240px,1fr)_220px_220px_auto] lg:px-8">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Cari nama, kode, kecamatan, atau TAP" className="pl-9" aria-label="Cari Mitra Outlet" />
                    </div>
                    <select value={kabupaten} onChange={(event) => { setKabupaten(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border bg-white px-3 text-sm" aria-label="Filter Kabupaten">
                        <option value="">Semua Kabupaten</option>
                        {(data?.filters.kabupaten || []).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <select value={tap} onChange={(event) => { setTap(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border bg-white px-3 text-sm" aria-label="Filter TAP">
                        <option value="">Semua TAP</option>
                        {(data?.filters.tap || []).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <Button type="button" variant="outline" onClick={resetFilters}>Reset</Button>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground"><span className="font-bold text-gray-950">{data?.total || 0}</span> outlet ditemukan</p>
                    {loading && <Loader2 className="h-5 w-5 animate-spin text-red-600" />}
                </div>

                {error ? (
                    <div className="rounded-lg border bg-white px-5 py-12 text-center text-sm text-muted-foreground">{error}</div>
                ) : !loading && data?.outlets.length === 0 ? (
                    <div className="rounded-lg border bg-white px-5 py-12 text-center text-sm text-muted-foreground">Outlet tidak ditemukan untuk filter tersebut.</div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {(data?.outlets || []).map((outlet) => (
                            <article key={outlet.publicToken} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                                <div className="grid grid-cols-[104px_1fr]">
                                    <div className="relative min-h-40 bg-gray-100">
                                        {outlet.photoUrl ? <Image src={outlet.photoUrl} alt={outlet.name} fill sizes="104px" className="object-cover" /> : <div className="flex h-full min-h-40 items-center justify-center text-red-600"><Store className="h-8 w-8" /></div>}
                                    </div>
                                    <div className="min-w-0 p-4">
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="secondary">{outlet.category}</Badge>
                                            {outlet.branding && <Badge variant="outline">{outlet.branding}</Badge>}
                                        </div>
                                        <h2 className="mt-3 truncate font-bold text-gray-950">{outlet.name}</h2>
                                        <p className="text-xs text-muted-foreground">{outlet.outletCode}</p>
                                        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                                            <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {outlet.kecamatan}, {outlet.kabupaten}</p>
                                            <p className="flex items-start gap-2"><Route className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {outlet.tap || "TAP belum diisi"}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between border-t px-4 py-3">
                                    <span className="text-xs text-muted-foreground">PJP {outlet.pjpDay} · {outlet.pjpType}</span>
                                    <Link href={`/mitra/o/${outlet.publicToken}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700">Lihat Profil <ArrowRight className="h-4 w-4" /></Link>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {data && data.pageCount > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-3">
                        <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Sebelumnya</Button>
                        <span className="text-sm text-muted-foreground">Halaman {data.page} dari {data.pageCount}</span>
                        <Button variant="outline" disabled={page >= data.pageCount || loading} onClick={() => setPage((current) => current + 1)}>Berikutnya</Button>
                    </div>
                )}
            </section>
        </main>
    );
}
