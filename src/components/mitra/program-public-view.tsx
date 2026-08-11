"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import React from "react";
import { ArrowLeft, ArrowRight, Award, Crown, Filter, Gift, Lock, Minus, Search, TrendingDown, TrendingUp, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TargetType = "OUTLET" | "SALESFORCE";
type MechanismType = "RACING" | "REWARD";

interface LeaderboardRow {
    participantKey: string;
    code: string;
    name: string;
    area: string;
    groupKey: string;
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
    groupKey?: string;
    rank: number;
    prizeLabel?: string | null;
}

interface RewardRuleRow {
    id: string;
    rankFrom: number | null;
    rankTo: number | null;
    paramKey: string | null;
    comparator: string | null;
    thresholdValue: string | null;
    rewardLabel: string;
}

interface ProgramParam {
    id: string;
    key: string;
    label: string;
    unit?: string | null;
    weight: string;
    isScored?: boolean;
}

interface ProgramDetail {
    program?: {
        name: string;
        mechanismType: MechanismType;
        groupBy?: "NONE" | "TAP" | "KABUPATEN" | "KECAMATAN";
        thumbnailUrl?: string | null;
        descriptionMd?: string | null;
        mechanismMd?: string | null;
        periodStart?: string | null;
        periodEnd?: string | null;
        status?: string;
    };
    params?: ProgramParam[];
    leaderboard: LeaderboardRow[];
    winners: WinnerRow[];
    rewardRules?: RewardRuleRow[];
    groups?: string[];
}

function formatTanggal(value?: string | null) {
    if (!value) return "";
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function formatPoin(value: string | number) {
    return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

/**
 * Platinum, emas, perunggu untuk tiga besar; sisanya netral.
 *
 * Sebelumnya juara 1 emas dan juara 3 oranye -- dua rona bertetangga yang sekilas
 * tertukar. Sekarang tiap tingkat memakai keluarga warna yang berjauhan: dingin keperakan,
 * kuning hangat, lalu tembaga pekat. Juara 1 tetap paling menonjol lewat mahkota, kartu
 * yang terangkat, dan bayangannya -- bukan lewat warna yang paling mencolok.
 */
function gayaPeringkat(rank: number | null) {
    if (!rank) return "bg-gray-100 text-gray-400 ring-gray-200";
    if (rank === 1) return "bg-slate-200 text-slate-800 ring-slate-400";
    if (rank === 2) return "bg-amber-100 text-amber-700 ring-amber-300";
    if (rank === 3) return "bg-orange-200 text-orange-800 ring-orange-400";
    return "bg-gray-100 text-gray-600 ring-gray-200";
}

/** Warna kartu podium, sejalan dengan lencana peringkat di tabel. */
function gayaKartuPodium(rank: number) {
    if (rank === 1) return "border-slate-400 bg-gradient-to-b from-slate-100 via-white to-white shadow-md sm:-mt-3 sm:pb-6";
    if (rank === 2) return "border-amber-300 bg-amber-50/60";
    return "border-orange-300 bg-orange-50/70";
}

function warnaIkonPodium(rank: number) {
    if (rank === 1) return "text-slate-600";
    if (rank === 2) return "text-amber-500";
    return "text-orange-600";
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

    // 401 pada program salesforce berarti belum terverifikasi OTP, bukan gagal memuat --
    // isinya tetap dikembalikan sebagian (nama dan periode) untuk memperkenalkan program.
    const [locked, setLocked] = React.useState(false);

    const muat = React.useCallback(() => {
        setLoading(true);
        fetch(`/api/public/mitra/programs/${slug}?targetType=${targetType}`)
            .then(async (res) => {
                const isi = await res.json().catch(() => null);
                if (res.status === 401 && isi?.locked) {
                    setLocked(true);
                    setData({ program: isi.program, leaderboard: [], winners: [] });
                    return;
                }
                setLocked(false);
                setData(res.ok ? isi : null);
            })
            .finally(() => setLoading(false));
    }, [slug, targetType]);

    React.useEffect(() => { muat(); }, [muat]);

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
    const semuaBaris = React.useMemo(() => data?.leaderboard || [], [data]);
    const semuaPemenang = data?.winners || [];
    const programParams = data?.params || [];
    const rewardRules = data?.rewardRules || [];
    // Dibungkus useMemo karena dipakai sebagai dependensi effect: array baru tiap render
    // akan membuat effect pemilih wilayah berjalan terus-menerus.
    const groups = React.useMemo(() => data?.groups || [], [data]);
    const groupBy = program?.groupBy || "NONE";
    const periode = [formatTanggal(program?.periodStart), formatTanggal(program?.periodEnd)].filter(Boolean).join(" – ");

    /**
     * Program yang dibagi per wilayah punya papan peringkat sendiri di tiap wilayah. Saat
     * belum ada wilayah yang dipilih, wilayah pertama ditampilkan lebih dulu -- menumpuk
     * semua wilayah dalam satu tabel akan menampilkan banyak "juara 1" berjajar tanpa
     * penjelasan.
     */
    const [group, setGroup] = React.useState("");
    React.useEffect(() => {
        if (groups.length > 0) setGroup((sekarang) => (sekarang && groups.includes(sekarang) ? sekarang : groups[0]));
    }, [groups]);

    const leaderboard = React.useMemo(
        () => (groupBy === "NONE" || !group ? semuaBaris : semuaBaris.filter((row) => row.groupKey === group)),
        [semuaBaris, groupBy, group]
    );
    const winners = groupBy === "NONE" || !group
        ? semuaPemenang
        : semuaPemenang.filter((row) => (row.groupKey || "") === group);
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
                    {program?.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={program.thumbnailUrl}
                            alt={program.name}
                            className="mt-5 max-h-52 w-full max-w-3xl rounded-lg object-cover shadow-lg"
                        />
                    )}
                </div>
            </section>

            {locked ? (
                <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                    <GerbangOtp slug={slug} onVerified={muat} />
                </section>
            ) : (
            <>

            <section className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                {isRacing
                    ? podium.length > 0 && <PodiumPemenang winners={podium} sementara={!adaPemenangResmi} />
                    : adaPemenangResmi && <DaftarPenerima winners={winners} />}

                {rewardRules.length > 0 && (
                    <DaftarHadiah rules={rewardRules} isRacing={isRacing} params={programParams} />
                )}

                {(programParams.length > 0 || program?.mechanismMd) && (
                    <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
                        <h2 className="text-sm font-bold sm:text-base">Mekanisme &amp; Parameter Penilaian</h2>
                        {program?.mechanismMd && (
                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{program.mechanismMd}</p>
                        )}
                        {programParams.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
                                {programParams.map((param) => (
                                    <span key={param.id} className="inline-flex items-center gap-1.5 rounded-full border bg-gray-50 px-2.5 py-1 text-[11px] sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs">
                                        <span className="font-semibold text-gray-950">{param.label}</span>
                                        {param.unit && <span className="text-muted-foreground">({param.unit})</span>}
                                        {/* Parameter informasi tidak punya bobot -- menampilkan "bobot 0"
                                            akan terbaca seolah nilainya dihitung tapi tidak berarti. */}
                                        {param.isScored === false ? (
                                            <span className="rounded-full bg-gray-200 px-2 py-0.5 font-bold text-gray-600">
                                                informasi
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">
                                                bobot {Number(param.weight).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                                            </span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {groups.length > 0 && (
                    <div className="rounded-lg border bg-white p-3 shadow-sm sm:p-4">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-950">
                                <Filter className="h-4 w-4 text-red-600" />
                                Pilih {groupBy === "TAP" ? "TAP" : groupBy === "KABUPATEN" ? "Kabupaten" : "Kecamatan"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                Peringkat dan pemenang dihitung terpisah di tiap wilayah.
                            </span>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5 sm:gap-2">
                            {groups.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setGroup(item)}
                                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition sm:px-3.5 sm:py-1.5 sm:text-xs ${
                                        group === item
                                            ? "bg-red-600 text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Pencarian berada tepat di atas tabel: yang dicari peserta adalah barisnya
                    sendiri, jadi hasilnya muncul berdampingan dengan daftar lengkapnya. */}
                <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
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

                <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5 sm:py-4">
                        <div>
                            <h2 className="text-sm font-bold sm:text-base">{isRacing ? "Papan Peringkat Peserta" : "Tabel Pencapaian Peserta"}</h2>
                            <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                                {leaderboard.length > 0
                                    ? `${leaderboard.length.toLocaleString("id-ID")} peserta${diperbarui ? ` · diperbarui ${formatTanggal(diperbarui)}` : ""}`
                                    : "Pencapaian dihitung ulang setiap kali data baru diunggah."}
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs sm:text-sm" style={{ minWidth: `${360 + programParams.length * 92}px` }}>
                            <thead>
                                {/* Kolom parameter dibangun dari konfigurasi program, jadi tiap
                                    program otomatis punya kolom pencapaiannya sendiri. */}
                                <tr className="border-b bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs">
                                    {isRacing && <th className="w-16 px-3 py-2.5 text-left sm:w-24 sm:px-4 sm:py-3">Rank</th>}
                                    <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">{isSalesforce ? "Salesforce" : "Kode"}</th>
                                    {!isSalesforce && <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">Nama Outlet</th>}
                                    <th className="px-3 py-2.5 text-left sm:px-4 sm:py-3">{isSalesforce ? "TAP" : "Kecamatan"}</th>
                                    {programParams.map((param) => (
                                        <th key={param.id} className="px-3 py-2.5 text-right sm:px-4 sm:py-3">
                                            {param.label}{param.unit ? ` (${param.unit})` : ""}
                                            {param.isScored === false && (
                                                <span className="ml-1 font-normal normal-case text-gray-400">(info)</span>
                                            )}
                                        </th>
                                    ))}
                                    <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={jumlahKolom} className="h-24 text-center text-muted-foreground">Memuat...</td></tr>
                                ) : leaderboard.length ? leaderboard.map((row) => (
                                    <tr key={row.participantKey} className="border-b last:border-0 odd:bg-gray-50/50 hover:bg-red-50/40">
                                        {isRacing && (
                                            <td className="px-3 py-2 sm:px-4 sm:py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold ring-1 ${gayaPeringkat(row.rank)}`}>
                                                        {row.rank ?? "-"}
                                                    </span>
                                                    <PergerakanPeringkat rank={row.rank} prevRank={row.prevRank} ringkas />
                                                </div>
                                            </td>
                                        )}
                                        <td className={`px-3 py-2 sm:px-4 sm:py-3 ${isSalesforce ? "font-semibold text-gray-950" : "font-mono text-[11px] text-muted-foreground sm:text-xs"}`}>
                                            {isSalesforce ? row.name : row.code}
                                        </td>
                                        {!isSalesforce && (
                                            <td className="max-w-[11rem] px-3 py-2 sm:max-w-none sm:px-4 sm:py-3">
                                                <span className="block truncate font-semibold text-gray-950 sm:inline sm:whitespace-normal" title={row.name}>{row.name}</span>
                                                {row.rank === null && (
                                                    <span className="mt-0.5 inline-block rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:ml-2 sm:mt-0">belum ada data</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-3 py-2 text-muted-foreground sm:px-4 sm:py-3">{row.area || "-"}</td>
                                        {programParams.map((param) => (
                                            <td key={param.id} className="px-3 py-2 text-right tabular-nums text-gray-700 sm:px-4 sm:py-3">
                                                {formatPoin(row.metrics?.[param.key]?.raw ?? 0)}
                                            </td>
                                        ))}
                                        <td className="px-3 py-2 text-right font-extrabold tabular-nums text-gray-950 sm:px-4 sm:py-3">{formatPoin(row.totalPoints)}</td>
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
            </>
            )}
        </main>
    );
}

/**
 * Gerbang OTP untuk program salesforce. Isi program menyangkut pencapaian dan insentif
 * per orang, jadi hanya nomor yang terdaftar di whitelist yang boleh membukanya.
 */
function GerbangOtp({ slug, onVerified }: { slug: string; onVerified: () => void }) {
    const [phone, setPhone] = React.useState("");
    const [code, setCode] = React.useState("");
    const [tahap, setTahap] = React.useState<"nomor" | "kode">("nomor");
    const [busy, setBusy] = React.useState(false);
    const [pesan, setPesan] = React.useState<{ ok: boolean; teks: string } | null>(null);

    const mintaOtp = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setPesan(null);
        const res = await fetch(`/api/public/mitra/programs/${slug}/otp/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
        });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        setPesan({ ok: res.ok, teks: data.message || "Permintaan OTP gagal diproses." });
        if (res.ok) setTahap("kode");
    };

    const verifikasi = async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setPesan(null);
        const res = await fetch(`/api/public/mitra/programs/${slug}/otp/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, code }),
        });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (res.ok) { onVerified(); return; }
        setPesan({ ok: false, teks: data.error || "Kode OTP tidak valid." });
    };

    return (
        <div className="mx-auto max-w-md rounded-lg border bg-white p-6 shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Lock className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-center font-bold text-gray-950">Halaman Khusus Salesforce</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
                {tahap === "nomor"
                    ? "Masukkan nomor WhatsApp Anda yang terdaftar untuk menerima kode verifikasi."
                    : `Kode dikirim ke ${phone}. Masukkan 6 digit yang Anda terima.`}
            </p>

            <form onSubmit={tahap === "nomor" ? mintaOtp : verifikasi} className="mt-5 space-y-3">
                {tahap === "nomor" ? (
                    <Input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="081234567890"
                        inputMode="tel"
                        aria-label="Nomor WhatsApp"
                    />
                ) : (
                    <Input
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        inputMode="numeric"
                        className="text-center text-lg tracking-[0.4em]"
                        aria-label="Kode OTP"
                    />
                )}

                <Button type="submit" className="w-full" disabled={busy || (tahap === "nomor" ? !phone.trim() : code.length !== 6)}>
                    {busy ? "Memproses..." : tahap === "nomor" ? "Kirim Kode OTP" : "Buka Program"}
                </Button>

                {tahap === "kode" && (
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => { setTahap("nomor"); setCode(""); setPesan(null); }}
                    >
                        Ganti nomor
                    </Button>
                )}
            </form>

            {pesan && (
                <p className={`mt-4 rounded-lg p-3 text-sm ${pesan.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {pesan.teks}
                </p>
            )}
        </div>
    );
}

/**
 * Hadiah yang diperebutkan, dibaca dari aturan program. Sebelumnya hadiah baru terlihat
 * setelah pemenang diumumkan -- terlambat untuk memotivasi siapa pun selama program
 * masih berjalan.
 */
function DaftarHadiah({ rules, isRacing, params }: { rules: RewardRuleRow[]; isRacing: boolean; params: ProgramParam[] }) {
    const labelParam = (key: string | null) => {
        if (!key) return "Total poin";
        return params.find((param) => param.key === key)?.label || key;
    };

    const syarat = (rule: RewardRuleRow) => {
        if (isRacing) {
            const dari = rule.rankFrom ?? 1;
            const sampai = rule.rankTo ?? dari;
            return dari === sampai ? `Juara ${dari}` : `Juara ${dari} – ${sampai}`;
        }
        return `${labelParam(rule.paramKey)} ${rule.comparator || ">="} ${formatPoin(rule.thresholdValue || 0)}`;
    };

    return (
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
                <Gift className="h-4 w-4 text-red-600 sm:h-5 sm:w-5" />
                <h2 className="text-sm font-bold sm:text-base">Hadiah Program</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-2.5 rounded-lg border bg-gray-50 px-3 py-2">
                        <span className="inline-flex shrink-0 items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-red-700 ring-1 ring-red-200">
                            {syarat(rule)}
                        </span>
                        <p className="min-w-0 truncate text-sm font-semibold text-gray-950">{rule.rewardLabel}</p>
                    </div>
                ))}
            </div>
        </div>
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
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 sm:mb-5">
                {/* Netral, bukan emas: amber di kartu ini kini berarti juara 2, jadi ikon
                    judul yang keemasan akan terbaca seperti penanda peringkat. */}
                <Trophy className="h-4 w-4 text-slate-600 sm:h-5 sm:w-5" />
                <h2 className="text-sm font-bold sm:text-base">{sementara ? "Pemenang Sementara" : "Pemenang Program"}</h2>
                {sementara && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 sm:text-xs">
                        Belum final
                    </span>
                )}
            </div>

            <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
                {urutanPodium.map((winner) => {
                    const juara = winner.rank === 1;
                    return (
                        <div
                            key={`${winner.participantKey}-${winner.rank}`}
                            /**
                             * Di layar sempit kartunya jadi baris mendatar -- podium bertingkat
                             * hanya masuk akal saat ketiganya berjajar. order-first menaikkan
                             * juara 1 ke atas di sana; kelasnya ditulis utuh, bukan dirangkai
                             * dari variabel, supaya ikut ter-generate.
                             */
                            className={`${juara ? "order-first sm:order-none" : ""} flex items-center gap-3 rounded-lg border-2 p-2.5 text-left sm:block sm:p-4 sm:text-center ${gayaKartuPodium(winner.rank)}`}
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm sm:mx-auto sm:mb-2 sm:h-10 sm:w-10">
                                {juara
                                    ? <Crown className={`h-4 w-4 sm:h-5 sm:w-5 ${warnaIkonPodium(winner.rank)}`} />
                                    : <Award className={`h-4 w-4 sm:h-5 sm:w-5 ${warnaIkonPodium(winner.rank)}`} />}
                            </div>

                            <div className="min-w-0 flex-1 sm:flex-none">
                                <p className={`text-[10px] font-extrabold uppercase tracking-wide sm:text-xs ${juara ? "text-slate-700" : "text-muted-foreground"}`}>
                                    Juara {winner.rank}
                                </p>
                                {/* Nama peserta bisa sangat panjang (kode + nomor + nama pemilik),
                                    jadi dipotong alih-alih memanjangkan kartu berlipat-lipat. */}
                                <p className="truncate text-sm font-bold text-gray-950 sm:mt-1 sm:whitespace-normal sm:text-base" title={winner.name}>
                                    {winner.name}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{winner.code}</p>
                            </div>

                            {winner.prizeLabel && (
                                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200 sm:mt-2 sm:inline-block sm:text-xs">
                                    {winner.prizeLabel}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {sisanya.length > 0 && (
                <div className="mt-2 grid gap-2 sm:mt-4 sm:grid-cols-2 lg:grid-cols-3">
                    {sisanya.map((winner) => (
                        <div key={`${winner.participantKey}-${winner.rank}`} className="flex items-center gap-3 rounded-lg border bg-gray-50 px-3 py-2">
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-extrabold text-gray-600 ring-1 ring-gray-200">
                                {winner.rank}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-950">{winner.name}</p>
                                <p className="truncate text-[11px] text-muted-foreground">{winner.prizeLabel || winner.code}</p>
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
