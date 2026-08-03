"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import React from "react";
import { ArrowLeft, Medal, Search, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LeaderboardRow {
    outletId: string;
    outletName: string;
    outletCode: string;
    kabupaten: string;
    kecamatan: string;
    totalPoints: string;
    rank: number;
    prevRank?: number | null;
}

interface WinnerRow {
    outletId: string;
    outletName: string;
    outletCode: string;
    rank: number;
    prizeLabel?: string | null;
}

export default function MitraProgramDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const slug = String(params.slug || "");
    const initialQuery = searchParams.get("q") || "";
    const [query, setQuery] = React.useState(initialQuery);
    const [loading, setLoading] = React.useState(true);
    const [data, setData] = React.useState<{
        program?: { name: string; descriptionMd?: string; mechanismMd?: string };
        leaderboard: LeaderboardRow[];
        winners: WinnerRow[];
    } | null>(null);

    const load = React.useCallback((q = "") => {
        setLoading(true);
        fetch(`/api/public/mitra/programs/${slug}?q=${encodeURIComponent(q)}`)
            .then((res) => res.ok ? res.json() : null)
            .then(setData)
            .finally(() => setLoading(false));
    }, [slug]);

    React.useEffect(() => {
        load(initialQuery);
    }, [initialQuery, load]);

    return (
        <main className="min-h-screen bg-gray-50 pt-20">
            <section className="border-b bg-white">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <Link href="/program" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-red-600">
                        <ArrowLeft className="h-4 w-4" />
                        Kembali
                    </Link>
                    <p className="text-sm font-bold uppercase tracking-widest text-red-600">Leaderboard Program</p>
                    <h1 className="mt-2 text-3xl font-extrabold text-gray-950">{data?.program?.name || "Program Mitra"}</h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{data?.program?.descriptionMd || "Memuat data program..."}</p>
                </div>
            </section>

            <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                {data?.winners && data.winners.length > 0 && (
                    <div className="rounded-lg border bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-orange-500" />
                            <h2 className="font-bold">Pemenang Dipublikasikan</h2>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            {data.winners.map((winner) => (
                                <div key={`${winner.outletId}-${winner.rank}`} className="rounded-lg border bg-orange-50/50 p-4">
                                    <p className="text-xs font-bold text-orange-600">Peringkat #{winner.rank}</p>
                                    <p className="mt-1 font-semibold">{winner.outletName}</p>
                                    <p className="text-xs text-muted-foreground">{winner.outletCode}</p>
                                    {winner.prizeLabel && <p className="mt-2 text-sm">{winner.prizeLabel}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="rounded-lg border bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="font-bold">Ranking Outlet</h2>
                            <p className="text-sm text-muted-foreground">Cari berdasarkan nama, kode outlet, kecamatan, atau kabupaten.</p>
                        </div>
                        <form
                            className="flex gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                load(query);
                            }}
                        >
                            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari outlet" className="w-full md:w-72" />
                            <Button type="submit" size="icon" aria-label="Cari">
                                <Search className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-20">Rank</TableHead>
                                    <TableHead>Outlet</TableHead>
                                    <TableHead>Wilayah</TableHead>
                                    <TableHead className="text-right">Poin</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                                ) : data?.leaderboard?.length ? data.leaderboard.map((row) => (
                                    <TableRow key={row.outletId}>
                                        <TableCell>
                                            <span className="inline-flex items-center gap-1 font-bold text-red-600">
                                                <Medal className="h-4 w-4" /> {row.rank}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <p className="font-semibold">{row.outletName}</p>
                                            <p className="text-xs text-muted-foreground">{row.outletCode}</p>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{row.kecamatan}, {row.kabupaten}</TableCell>
                                        <TableCell className="text-right font-bold">{Number(row.totalPoints).toLocaleString("id-ID")}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Leaderboard belum tersedia.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </section>
        </main>
    );
}
