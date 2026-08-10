"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import React from "react";
import { ArrowLeft, ArrowRight, Award, Crown, Gift, Minus, Search, TrendingDown, TrendingUp, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TargetType = "OUTLET" | "SALESFORCE";
type MechanismType = "RACING" | "REWARD";

interface LeaderboardRow {
    participantKey: string;
    code: string;
    name: string;
    area: string;
    totalPoints: number;
    /** null untuk peserta yang belum punya skor sama sekali. */
    rank: number | null;
    prevRank?: number | null;
    computedAt?: string | null;
    metrics?: Record<string, { raw: number; points: number }>;
}

interface WinnerRow {
    participantKey: string;
    code: string;
    name: string;
    rank: number;
    prizeLabel?: string | null;
}

interface ProgramParam {
    id: string;
    key: string;
    label: string;
    unit?: string | null;
    weight: string;
}

interface ProgramDetail {
    program?: {
        name: string;
        mechanismType: MechanismType;
        descriptionMd?: string | null;
        mechanismMd?: string | null;
        periodStart?: string | null;
        periodEnd?: string | null;
        status?: string;
    };
    params?: ProgramParam[];
    leaderboard: LeaderboardRow[];
    winners: WinnerRow[];
}

function formatTanggal(value?: string | null) {
    if (!value) return "";
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function formatPoin(value: string | number) {
    return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

/** Emas, perak, perunggu untuk tiga besar; sisanya netral. */
function gayaPeringkat(rank: number | null) {
    if (!rank) return "bg-gray-100 text-gray-400 ring-gray-200";
    if (rank === 1) return "bg-amber-100 text-amber-700 ring-amber-300";
    if (rank === 2) return "bg-slate-100 text-slate-700 ring-slate-300";
    if (rank === 3) return "bg-orange-100 text-orange-700 ring-orange-300";
    return "bg-gray-100 text-gray-600 ring-gray-200";
}

export function ProgramPublicView({ targetType }: { targetType: TargetType }) {
    const routeParams = useParams();
    const searchParams = useSearchParams();
    const slug = String(routeParams.slug || "");
    const initialQuery = searchParams.get("q") || "";
    const isSalesforce = targetType === "SALESFORCE";
    const istilah = isSalesforce ? "Salesforce" : "Outlet";
    const kembaliKe = isSalesforce ? "/mitra/program-sf" : "/program";

    const [data, setData] = React.useState<ProgramDetail | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [query, setQuery] = React.useState(initialQuery);
    const [mencari, setMencari] = React.useState(false);
    // null = belum pernah mencari; array kosong = sudah dicari tapi tidak ketemu.
    const [hasilCari, setHasilCari] = React.useState<LeaderboardRow[] | null>(null);

    React.useEffect(() => {
        setLoading(true);
        fetch(`/api/public/mitra/programs/${slug}?targetType=${targetType}`)
            .then((res) => res.ok ? res.json() : null)
            .then(setData)
            .finally(() => setLoading(false));
    }, [slug, targetType]);

    /**
     * Pencarian mengisi panel di atas tabel, bukan menyaring tabelnya. Peserta ingin tahu
     * posisinya sendiri tanpa kehilangan konteks papan peringkat penuh -- kalau tabelnya
     * ikut tersaring, ia hanya melihat satu baris tanpa pembanding.
     */
    const cariPeserta = React.useCallback(async (keyword: string) => {
        const clean = keyword.trim();
        if (!clean) { setHasilCari(null); return; }

        setMencari(true);
        try {
            const res = await fetch(`/api/public/mitra/programs/${slug}?targetType=${targetType}&q=${encodeURIComponent(clean)}`);
            const hasil = res.ok ? await res.json() : null;
            setHasilCari(Array.isArray(hasil?.leaderboard) ? hasil.leaderboard : []);
        } catch {
            setHasilCari([]);
        } finally {
            setMencari(false);
        }
    }, [slug, targetType]);

    React.useEffect(() => {
        if (initialQuery) cariPeserta(initialQuery);
    }, [initialQuery, cariPeserta]);

    const program = data?.program;
    const mechanismType: MechanismType = program?.mechanismType || "RACING";
    const isRacing = mechanismType === "RACING";
    const leaderboard = data?.leaderboard || [];
    const winners = data?.winners || [];
    const programParams = data?.params || [];
    const periode = [formatTanggal(program?.periodStart), formatTanggal(program?.periodEnd)].filter(Boolean).join(" – ");
    const diperbarui = leaderboard[0]?.computedAt;

    /**
     * Selama admin belum mempublikasikan pemenang resmi, podium diisi tiga teratas papan
     * peringkat berjalan dan ditandai "sementara". Tanpa ini program yang sedang berjalan
     * tidak punya sorotan sama sekali -- padahal justru itu yang membuat peserta rutin
     * membukanya. Hanya berlaku untuk racing: pada reward tidak ada yang "diungguli".
     */
    const adaPemenangResmi = winners.length > 0;
    const pemenangSementara: WinnerRow[] = leaderboard
        .filter((row) => row.rank !== null)
        .slice(0, 3)
        .map((row) => ({
            participantKey: row.participantKey,
            code: row.code,
            name: row.name,
            rank: row.rank as number,
            prizeLabel: `${formatPoin(row.totalPoints)} poin`,
        }));
    const podium = adaPemenangResmi ? winners : pemenangSementara;

    // kode, nama, area, total + satu kolom per parameter; rangking hanya pada racing.
    const jumlahKolom = 4 + programParams.length + (isRacing ? 1 : 0);

    return (
        <main className="min-h-screen bg-gray-50">
            <section className="bg-gradient-to-br from-red-700 via-red-600 to-orange-500">
                <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                    <Link href={kembaliKe} className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white">
                        <ArrowLeft className="h-4 w-4" />
                        Kembali
                    </Link>

                    <div className="mt-6 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
                            {isRacing ? <Trophy className="h-3.5 w-3.5" /> : <Gift className="h-3.5 w-3.5" />}
                            Program {istilah} · {isRacing ? "Racing" : "Reward"}
                        </span>
                        {program?.status && (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-600">
                                {program.status}
                            </span>
                        )}
                    </div>

                    <h1 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">
                        {program?.name || (loading ? "Memuat program..." : "Program Mitra")}
                    </h1>
                    {periode && <p className="mt-2 text-sm font-semibold text-white/90">Periode Program {periode}</p>}
                    {program?.descriptionMd && (
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-white/85">{program.descriptionMd}</p>
                    )}
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Kartu pencarian menumpuk hero supaya jadi hal pertama yang dilihat peserta
                    ketika membuka halaman dari tautan atau QR. */}
                <div className="-mt-6 rounded-lg border bg-white p-5 shadow-md">
                    <h2 className="text-sm font-bold text-gray-950">Cari Pencapaian {istilah}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {isSalesforce ? "Masukkan nama salesforce atau TAP." : "Masukkan kode outlet, nama outlet, atau kecamatan."}
                    </p>

                    <form
                        className="mt-3 flex flex-col gap-2 sm:flex-row"
                        onSubmit={(event) => { event.preventDefault(); cariPeserta(query); }}
                    >
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={isSalesforce ? "Contoh: Budi Santoso" : "Contoh: 2201043676"}
                            className="sm:max-w-sm"
                            aria-label={`Kode atau nama ${istilah.toLowerCase()}`}
                        />
                        <Button type="submit" disabled={mencari || !query.trim()}>
                            <Search className="h-4 w-4" />
                            {mencari ? "Mencari..." : "Cari"}
                        </Button>
                        {hasilCari !== null && (
                            <Button type="button" variant="ghost" onClick={() => { setQuery(""); setHasilCari(null); }}>
                                Reset
                            </Button>
                        )}
                    </form>

                    {hasilCari !== null && (
                        hasilCari.length === 0 ? (
                            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
                                {istilah} tidak ditemukan! Silakan masukkan kata kunci yang sesuai.
                            </p>
                        ) : (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {hasilCari.slice(0, 4).map((row) => (
                                    <div key={row.participantKey} className="rounded-lg border-2 border-red-100 bg-red-50/40 p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate font-bold text-gray-950">{row.name}</p>
                                                <p className="text-xs text-muted-foreground">{row.code}</p>
                                            </div>
                                            {isRacing && (
                                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${gayaPeringkat(row.rank)}`}>
                                                    #{row.rank ?? "-"}
                                                </span>
                                            )}
                                        </div>
                                        {row.area && <p className="mt-3 text-xs text-muted-foreground">{row.area}</p>}
                                        <p className="mt-2 text-lg font-extrabold text-red-600">
                                            {formatPoin(row.totalPoints)} <span className="text-xs font-semibold text-muted-foreground">poin</span>
                                        </p>
                                        {isRacing && <PergerakanPeringkat rank={row.rank} prevRank={row.prevRank} />}

                                        {programParams.length > 0 && (
                                            <dl className="mt-3 space-y-1 border-t pt-3">
                                                {programParams.map((param) => (
                                                    <div key={param.id} className="flex items-baseline justify-between gap-2 text-xs">
                                                        <dt className="truncate text-muted-foreground">{param.label}</dt>
                                                        <dd className="shrink-0 font-semibold tabular-nums text-gray-950">
                                                            {formatPoin(row.metrics?.[param.key]?.raw ?? 0)}
                                                            {param.unit ? ` ${param.unit}` : ""}
                                                        </dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        )}
                                    </div>
                                ))}
                                {hasilCari.length > 4 && (
                                    <p className="self-center text-xs text-muted-foreground">
                                        dan {hasilCari.length - 4} peserta lain cocok. Persempit kata kuncinya.
                                    </p>
                                )}
                            </div>
                        )
                    )}
                </div>
            </section>

            <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                {isRacing
                    ? podium.length > 0 && <PodiumPemenang winners={podium} sementara={!adaPemenangResmi} />
                    : adaPemenangResmi && <DaftarPenerima winners={winners} />}

                {(programParams.length > 0 || program?.mechanismMd) && (
                    <div className="rounded-lg border bg-white p-5 shadow-sm">
                        <h2 className="font-bold">Mekanisme &amp; Parameter Penilaian</h2>
                        {program?.mechanismMd && (
                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{program.mechanismMd}</p>
                        )}
                        {programParams.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {programParams.map((param) => (
                                    <span key={param.id} className="inline-flex items-center gap-2 rounded-full border bg-gray-50 px-3 py-1.5 text-xs">
                                        <span className="font-semibold text-gray-950">{param.label}</span>
                                        {param.unit && <span className="text-muted-foreground">({param.unit})</span>}
                                        <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">
                                            bobot {Number(param.weight).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                        <div>
                            <h2 className="font-bold">{isRacing ? "Papan Peringkat Peserta" : "Tabel Pencapaian Peserta"}</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {leaderboard.length > 0
                                    ? `${leaderboard.length.toLocaleString("id-ID")} peserta${diperbarui ? ` · diperbarui ${formatTanggal(diperbarui)}` : ""}`
                                    : "Pencapaian dihitung ulang setiap kali data baru diunggah."}
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm" style={{ minWidth: `${520 + programParams.length * 120}px` }}>
                            <thead>
                                {/* Kolom parameter dibangun dari konfigurasi program, jadi tiap
                                    program otomatis punya kolom pencapaiannya sendiri. */}
                                <tr className="border-b bg-gray-50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    {isRacing && <th className="w-24 px-4 py-3 text-left">Rangking</th>}
                                    <th className="px-4 py-3 text-left">{isSalesforce ? "Salesforce" : "Kode Outlet"}</th>
                                    {!isSalesforce && <th className="px-4 py-3 text-left">Nama Outlet</th>}
                                    <th className="px-4 py-3 text-left">{isSalesforce ? "TAP" : "Kecamatan"}</th>
                                    {programParams.map((param) => (
                                        <th key={param.id} className="px-4 py-3 text-right">
                                            {param.label}{param.unit ? ` (${param.unit})` : ""}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-right">Total Poin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={jumlahKolom} className="h-24 text-center text-muted-foreground">Memuat...</td></tr>
                                ) : leaderboard.length ? leaderboard.map((row) => (
                                    <tr key={row.participantKey} className="border-b last:border-0 odd:bg-gray-50/50 hover:bg-red-50/40">
                                        {isRacing && (
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-extrabold ring-1 ${gayaPeringkat(row.rank)}`}>
                                                        {row.rank ?? "-"}
                                                    </span>
                                                    <PergerakanPeringkat rank={row.rank} prevRank={row.prevRank} ringkas />
                                                </div>
                                            </td>
                                        )}
                                        <td className={`px-4 py-3 ${isSalesforce ? "font-semibold text-gray-950" : "font-mono text-xs text-muted-foreground"}`}>
                                            {isSalesforce ? row.name : row.code}
                                        </td>
                                        {!isSalesforce && (
                                            <td className="px-4 py-3">
                                                <span className="font-semibold text-gray-950">{row.name}</span>
                                                {row.rank === null && (
                                                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted-foreground">belum ada data</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-muted-foreground">{row.area || "-"}</td>
                                        {programParams.map((param) => (
                                            <td key={param.id} className="px-4 py-3 text-right tabular-nums text-gray-700">
                                                {formatPoin(row.metrics?.[param.key]?.raw ?? 0)}
                                            </td>
                                        ))}
                                        <td className="px-4 py-3 text-right font-extrabold tabular-nums text-gray-950">{formatPoin(row.totalPoints)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={jumlahKolom} className="h-24 text-center text-muted-foreground">Data pencapaian belum tersedia.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                    Pencapaian mengikuti data yang sudah diverifikasi admin.{" "}
                    <Link href="/mitra" className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline">
                        Lihat direktori outlet <ArrowRight className="h-3 w-3" />
                    </Link>
                </p>
            </section>
        </main>
    );
}

/**
 * prevRank sudah lama disimpan tetapi belum pernah ditampilkan. Arah pergerakan justru
 * bagian yang paling dicari peserta setelah data periode baru masuk.
 */
function PergerakanPeringkat({ rank, prevRank, ringkas = false }: { rank: number | null; prevRank?: number | null; ringkas?: boolean }) {
    // Peserta tanpa peringkat belum punya posisi untuk dibandingkan.
    if (!rank || !prevRank) {
        return ringkas ? null : <p className="mt-1 text-xs text-muted-foreground">Peserta baru</p>;
    }

    const selisih = prevRank - rank;
    if (selisih === 0) {
        return ringkas
            ? <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            : <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3.5 w-3.5" /> Tetap</p>;
    }

    const naik = selisih > 0;
    const Ikon = naik ? TrendingUp : TrendingDown;
    const warna = naik ? "text-green-600" : "text-red-600";

    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${warna} ${ringkas ? "" : "mt-1"}`}>
            <Ikon className="h-3.5 w-3.5" />
            {Math.abs(selisih)}
        </span>
    );
}

/** Juara 1 ditaruh di tengah dan dibuat lebih tinggi, seperti podium sungguhan. */
function PodiumPemenang({ winners, sementara }: { winners: WinnerRow[]; sementara: boolean }) {
    const urut = [...winners].sort((a, b) => a.rank - b.rank);
    const podium = urut.slice(0, 3);
    const sisanya = urut.slice(3);
    // Urutan tampil: 2 - 1 - 3, sedangkan pada layar sempit tetap 1 - 2 - 3.
    const urutanPodium = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

    return (
        <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h2 className="font-bold">{sementara ? "Pemenang Sementara" : "Pemenang Program"}</h2>
                {sementara && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                        Belum final — mengikuti data terakhir yang masuk
                    </span>
                )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {urutanPodium.map((winner) => {
                    const juara = winner.rank === 1;
                    return (
                        <div
                            key={`${winner.participantKey}-${winner.rank}`}
                            // order-first hanya berlaku di layar sempit: di sana kolomnya
                            // menumpuk, jadi juara 1 harus naik ke atas. Kelasnya ditulis
                            // utuh, bukan dirangkai dari variabel, supaya ikut ter-generate.
                            className={`${juara ? "order-first sm:order-none" : ""} rounded-lg border-2 p-4 text-center ${
                                juara
                                    ? "border-amber-300 bg-gradient-to-b from-amber-50 to-white sm:-mt-3 sm:pb-7"
                                    : winner.rank === 2
                                        ? "border-slate-200 bg-slate-50/60"
                                        : "border-orange-200 bg-orange-50/50"
                            }`}
                        >
                            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                                {juara ? <Crown className="h-5 w-5 text-amber-500" /> : <Award className={`h-5 w-5 ${winner.rank === 2 ? "text-slate-400" : "text-orange-400"}`} />}
                            </div>
                            <p className={`text-xs font-extrabold uppercase tracking-wide ${juara ? "text-amber-600" : "text-muted-foreground"}`}>
                                Juara {winner.rank}
                            </p>
                            <p className="mt-1 font-bold text-gray-950">{winner.name}</p>
                            <p className="text-xs text-muted-foreground">{winner.code}</p>
                            {winner.prizeLabel && (
                                <p className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                                    {winner.prizeLabel}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {sisanya.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sisanya.map((winner) => (
                        <div key={`${winner.participantKey}-${winner.rank}`} className="flex items-center gap-3 rounded-lg border bg-gray-50 px-4 py-3">
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-xs font-extrabold text-gray-600 ring-1 ring-gray-200">
                                {winner.rank}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-950">{winner.name}</p>
                                <p className="text-xs text-muted-foreground">{winner.prizeLabel || winner.code}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Program reward tidak punya juara -- semua yang mencapai target berdiri sejajar. Karena
 * itu penerimanya ditampilkan sebagai daftar setara, bukan podium bertingkat.
 */
function DaftarPenerima({ winners }: { winners: WinnerRow[] }) {
    return (
        <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Gift className="h-5 w-5 text-red-600" />
                <h2 className="font-bold">Penerima Hadiah</h2>
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                    {winners.length} peserta mencapai target
                </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {winners.map((winner) => (
                    <div key={`${winner.participantKey}-${winner.rank}`} className="flex items-start gap-3 rounded-lg border bg-gray-50 px-4 py-3">
                        <Award className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-950">{winner.name}</p>
                            <p className="text-xs text-muted-foreground">{winner.code}</p>
                            {winner.prizeLabel && (
                                <p className="mt-1.5 inline-block rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                                    {winner.prizeLabel}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
