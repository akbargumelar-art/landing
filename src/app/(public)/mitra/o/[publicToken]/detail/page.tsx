"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React from "react";
import { ArrowLeft, Camera, ChevronDown, ChevronUp, History, Lock, MapPin, Pencil, ShieldCheck, Tag } from "lucide-react";

import { InfoCard } from "@/components/mitra/info-card";
import { OdpSekitar } from "@/components/mitra/odp-sekitar";
import { afterMergerShareData, operatorShareData, OperatorShareChart } from "@/components/mitra/operator-share-chart";
import { OutletPhotoCard } from "@/components/mitra/outlet-photo-card";
import { Button } from "@/components/ui/button";
import { MITRA_DETAIL_FIELD_GROUPS } from "@/lib/mitra-fields";
import type { MitraMarketShareKey } from "@/lib/mitra-market-share";

interface DetailData {
    outlet: Record<string, string | number | null>;
    details: {
        ownerPhone: string;
        sellthruDigipos: Record<string, number>;
        sellthruNota: Record<string, number>;
        rechargeDigipos: Record<string, number>;
        updatedAt: string | null;
    };
    performance: {
        metricKey: string;
        metricLabel: string;
        unit?: string | null;
        periodYm: string;
        value: string;
    }[];
    marketShare: (Record<MitraMarketShareKey, string> & {
        kabupaten: string;
        kecamatan: string;
        /** Kapan angka wilayah ini terakhir diubah admin; dipakai sebagai keterangan kebaruan data. */
        updatedAt: string | null;
    }) | null;
    editLogs: EditLog[];
    peranPengakses: string | null;
}

interface EditLog {
    id: string;
    action: "PHOTO" | "LOCATION" | "BRANDING" | "PROFILE";
    actorType: "MITRA" | "ADMIN";
    actorLabel: string;
    createdAt: string;
}

/**
 * Halaman ini murni baca. Sesi OTP membuktikan hak MELIHAT, bukan identitas aktor yang boleh
 * mengubah data -- perubahan outlet dilakukan dari dashboard dengan akun Salesforce atau
 * Supervisor. Karena itu tidak ada state draft, handler mutasi, maupun kontrol edit di sini:
 * menyembunyikan tombol saja tidak cukup, kodenya sekalian tidak ada.
 */
export default function MitraOutletDetailPage() {
    const params = useParams();
    const publicToken = String(params.publicToken || "");
    const [data, setData] = React.useState<DetailData | null>(null);
    const [loading, setLoading] = React.useState(true);
    // Kosong (semua tertutup) sebagai default: tiga tabel ini panjang dan bukan yang
    // pertama ingin dilihat pembuka halaman, jadi disembunyikan sampai memang dibuka.
    const [grupTerbuka, setGrupTerbuka] = React.useState<Set<string>>(new Set());

    const alihkanGrup = (key: string) => {
        setGrupTerbuka((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const muat = React.useCallback(() => {
        return fetch(`/api/public/mitra/outlets/${publicToken}/detail`)
            .then((res) => res.ok ? res.json() : null)
            .then(setData);
    }, [publicToken]);

    React.useEffect(() => {
        muat().finally(() => setLoading(false));
    }, [muat]);

    if (loading) {
        return <main className="min-h-screen bg-gray-50 py-16 text-center text-sm text-muted-foreground">Memuat detail...</main>;
    }

    if (!data) {
        return (
            <main className="min-h-screen bg-gray-50 py-16">
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
        <main className="min-h-screen bg-gray-50">
            <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                <Link href={`/mitra/o/${publicToken}`} className="inline-flex items-center gap-2 text-sm font-semibold text-red-600">
                    <ArrowLeft className="h-4 w-4" />
                    Profil Outlet
                </Link>

                {/* 1. Data outlet */}
                <div className="rounded-lg border bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-red-600">Detail Terverifikasi</p>
                            <h1 className="mt-1 text-2xl font-extrabold">{data.outlet.name}</h1>
                            <p className="mt-1 text-sm text-muted-foreground">{data.outlet.outletCode} - {data.outlet.ownerName}</p>
                        </div>
                        {/* Keterangan pemegang nomor tetap ditampilkan sebagai konteks, tetapi
                            tidak lagi menentukan hak apa pun -- lencananya selalu berbentuk
                            "hanya lihat" supaya tidak ada yang menunggu tombol ubah muncul. */}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-muted-foreground">
                            <Lock className="h-3.5 w-3.5" />
                            {data.peranPengakses ? `${data.peranPengakses} · hanya lihat` : "Hanya lihat"}
                        </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <InfoCard label="Nama Owner" value={String(data.outlet.ownerName || "-")} />
                        <InfoCard label="Nomor Owner" value={data.details.ownerPhone || "-"} />
                        <InfoCard label="Nomor RS" value={String(data.outlet.rsNumber || "-")} />
                        <InfoCard label="TAP" value={String(data.outlet.tap || "-")} />
                        <InfoCard label="Salesforce" value={String(data.outlet.salesforce || "-")} />
                        <InfoCard label="Kabupaten" value={String(data.outlet.kabupaten || "-")} />
                        <InfoCard label="Kecamatan" value={String(data.outlet.kecamatan || "-")} />
                        <InfoCard label="Kategori" value={String(data.outlet.category || "-")} />
                        <InfoCard label="Jadwal PJP" value={`${String(data.outlet.pjpDay || "-")} / ${String(data.outlet.pjpType || "-")}`} />
                        <InfoCard label="Branding" value={String(data.outlet.branding || "-")} />
                    </div>

                    {data.outlet.locationUrl && (
                        <a href={String(data.outlet.locationUrl)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600">
                            <MapPin className="h-4 w-4" />
                            Buka lokasi outlet
                        </a>
                    )}

                </div>

                {/* 2. Market share kecamatan */}
                <div className="rounded-lg border bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                        <h2 className="font-bold">Market Share Kecamatan</h2>
                        <div className="text-xs text-muted-foreground sm:text-right">
                            <p>
                                {data.marketShare
                                    ? `${data.marketShare.kecamatan}, ${data.marketShare.kabupaten}`
                                    : "Angka wilayah, bukan angka outlet ini"}
                            </p>
                            {/* Angka pangsa pasar tidak berubah tiap hari, jadi tanggalnya ikut
                                menentukan arti angkanya -- tanpa itu pembaca tidak bisa tahu
                                apakah yang dilihatnya data bulan ini atau tahun lalu. */}
                            {data.marketShare?.updatedAt && (
                                <p className="mt-0.5">Data diperbarui {formatWaktu(data.marketShare.updatedAt)}</p>
                            )}
                        </div>
                    </div>

                    {data.marketShare ? (
                        <div className="mt-5 grid gap-6 lg:grid-cols-2">
                            <div>
                                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    Sebelum Merger
                                </p>
                                <OperatorShareChart data={operatorShareData(data.marketShare)} />
                            </div>
                            <div className="border-t pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    Setelah Merger (Data Input Langsung)
                                </p>
                                <OperatorShareChart data={afterMergerShareData(data.marketShare)} />
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-muted-foreground">
                            Belum ada data market share untuk kecamatan ini.
                        </p>
                    )}
                </div>

                {/* 3. Riwayat performance */}
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

                {/* 4. Tabel parameter: tiap parameter punya tiga angka (M-1, M, MoM). Tertutup
                    secara default -- tiga tabel ini panjang dan bukan hal pertama yang dicari
                    saat membuka halaman, jadi baru dirender saat memang dibuka. */}
                {MITRA_DETAIL_FIELD_GROUPS.map((group) => {
                    const values = data.details[group.key] || {};
                    const terbuka = grupTerbuka.has(group.key);
                    return (
                        <div key={group.key} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                            <button
                                type="button"
                                onClick={() => alihkanGrup(group.key)}
                                aria-expanded={terbuka}
                                className="flex w-full flex-wrap items-start justify-between gap-2 border-b bg-gray-50/70 px-5 py-4 text-left transition-colors hover:bg-gray-100/70"
                            >
                                <div className="flex items-start gap-2">
                                    {terbuka ? <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
                                    <div>
                                        <h2 className="font-bold">{group.title}</h2>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            FM-1 bulan sebelumnya penuh, M-1 periode sama bulan lalu, M bulan berjalan, MoM pertumbuhannya.
                                        </p>
                                    </div>
                                </div>
                                {/* Tanggal ini menjawab pertanyaan pertama pembaca angka: masih baru
                                    atau sudah basi. Sumbernya kolom updated_at yang tersentuh setiap
                                    unggahan berkas maupun suntingan manual. */}
                                <p className="text-xs text-muted-foreground">
                                    {data.details.updatedAt
                                        ? `Diperbarui ${formatWaktu(data.details.updatedAt)}`
                                        : "Belum pernah diperbarui"}
                                </p>
                            </button>

                            {terbuka && (
                            <>
                            {/* Dua bentuk, satu sumber data. Di ponsel tabel empat kolom selalu
                                memaksa geser ke samping, jadi barisnya dirender ulang sebagai
                                blok bertumpuk. Di layar lebar tabelnya table-fixed supaya kolom
                                angka tidak terlempar ke tepi kanan menjauhi nama parameternya. */}
                            <div className="divide-y md:hidden">
                                {group.rows.map((row) => (
                                    <div key={row.key} className={`px-4 py-3 ${row.level === 1 ? "bg-gray-50/60 pl-8" : ""}`}>
                                        <p className="flex items-center gap-1.5 text-sm">
                                            {row.level === 1 && <span className="text-muted-foreground" aria-hidden>&#8735;</span>}
                                            <span className={row.level === 1 ? "text-gray-700" : "font-medium text-gray-950"}>{row.label}</span>
                                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                {row.unit === "qty" ? "qty" : "rev"}
                                            </span>
                                        </p>

                                        {/* Dua kolom, bukan empat berjajar: empat angka dalam satu
                                            baris di layar sempit membuat tiap kotak terlalu sempit
                                            untuk angka ribuan. */}
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <div className="rounded-md bg-gray-50 px-2 py-1.5">
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">FM-1</p>
                                                <p className="tabular-nums text-sm text-gray-700">{formatValue(values[row.fm1Key])}</p>
                                            </div>
                                            <div className="rounded-md bg-gray-50 px-2 py-1.5">
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">M-1</p>
                                                <p className="tabular-nums text-sm text-gray-700">{formatValue(values[row.m1Key])}</p>
                                            </div>
                                            <div className="rounded-md bg-gray-50 px-2 py-1.5">
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">M</p>
                                                <p className="font-semibold tabular-nums text-sm text-gray-950">{formatValue(values[row.mKey])}</p>
                                            </div>
                                            <div className="rounded-md bg-gray-50 px-2 py-1.5">
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">MoM</p>
                                                <p className={`text-sm font-bold tabular-nums ${momClass(values[row.momKey])}`}>
                                                    {formatMoM(values[row.momKey])}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <table className="hidden w-full table-fixed border-collapse text-sm md:table">
                                <thead>
                                    {/* Kepala tabel lengket supaya nama kolom tetap terbaca saat
                                        menggulir tabel sepanjang 40 baris. */}
                                    <tr className="sticky top-0 z-10 bg-white text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-[inset_0_-1px_0_rgb(229,231,235)]">
                                        <th className="w-[40%] px-5 py-3 text-left">Parameter</th>
                                        <th className="w-[15%] border-l px-3 py-3 text-right">FM-1</th>
                                        <th className="w-[15%] border-l px-3 py-3 text-right">M-1</th>
                                        <th className="w-[15%] border-l px-3 py-3 text-right">M</th>
                                        <th className="w-[15%] border-l px-3 py-3 text-right">MoM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.rows.map((row) => (
                                        <tr key={row.key} className={`border-t transition-colors hover:bg-red-50/30 ${row.level === 1 ? "bg-gray-50/50" : ""}`}>
                                            {/* Rincian diberi indentasi dan garis penghubung supaya jelas
                                                bahwa angkanya bagian dari baris induk di atasnya, bukan
                                                parameter berdiri sendiri yang ikut dijumlahkan lagi. */}
                                            <td className={`truncate py-2 pr-3 ${row.level === 1 ? "pl-10" : "pl-5"}`}>
                                                {row.level === 1 && (
                                                    <span className="mr-1.5 text-muted-foreground" aria-hidden>&#8735;</span>
                                                )}
                                                <span className={row.level === 1 ? "text-gray-700" : "font-medium text-gray-950"}>{row.label}</span>
                                                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                    {row.unit === "qty" ? "qty" : "rev"}
                                                </span>
                                            </td>
                                            <td className="border-l px-3 py-2 text-right tabular-nums text-muted-foreground">{formatValue(values[row.fm1Key])}</td>
                                            <td className="border-l px-3 py-2 text-right tabular-nums text-muted-foreground">{formatValue(values[row.m1Key])}</td>
                                            <td className="border-l px-3 py-2 text-right font-semibold tabular-nums text-gray-950">{formatValue(values[row.mKey])}</td>
                                            <td className="border-l px-3 py-2 text-right">
                                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${momClass(values[row.momKey])}`}>
                                                    {formatMoM(values[row.momKey])}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </>
                            )}
                        </div>
                    );
                })}

                {/* 5. Foto outlet -- boleh langsung ganti tanpa mode edit. */}
                <OutletPhotoCard outlet={data.outlet} />

                {data.outlet.latitude != null && data.outlet.longitude != null && (
                    <OdpSekitar
                        outlet={{
                            publicToken: publicToken,
                            outletCode: String(data.outlet.outletCode || ""),
                            name: String(data.outlet.name || ""),
                            kabupaten: String(data.outlet.kabupaten || ""),
                            kecamatan: String(data.outlet.kecamatan || ""),
                            latitude: Number(data.outlet.latitude),
                            longitude: Number(data.outlet.longitude),
                        }}
                    />
                )}

                {/* Diarahkan ke login, bukan ke verifikasi OTP ulang: OTP berapa kali pun
                    diverifikasi tidak akan pernah membuka hak ubah. */}
                <p className="flex items-start gap-2 rounded-lg border bg-gray-50 p-4 text-sm text-muted-foreground">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        Halaman ini hanya menampilkan data. Untuk mengubah foto, lokasi, branding, atau profil
                        outlet, silakan{" "}
                        <Link href="/portal-admin" className="font-semibold text-red-600 hover:underline">
                            masuk menggunakan akun Salesforce atau Supervisor
                        </Link>.
                    </span>
                </p>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* 6. Lokasi outlet */}
                    <div className="rounded-lg border bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <h2 className="font-bold">Lokasi Outlet</h2>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Diambil dari GPS perangkat, bukan diketik. Dilakukan sesekali saja, saat memang dibutuhkan.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Koordinat Tersimpan</p>
                            <p className="mt-1 font-mono text-sm text-gray-950">
                                {data.outlet.latitude && data.outlet.longitude
                                    ? `${Number(data.outlet.latitude).toFixed(6)}, ${Number(data.outlet.longitude).toFixed(6)}`
                                    : "Belum ditandai"}
                            </p>
                            {data.outlet.locationUrl && (
                                <a href={String(data.outlet.locationUrl)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline">
                                    <MapPin className="h-3.5 w-3.5" />
                                    Buka di Google Maps
                                </a>
                            )}
                        </div>

                    </div>

                    {/* 7. Branding outlet */}
                    <div className="rounded-lg border bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-red-600" />
                                <h2 className="font-bold">Branding Outlet</h2>
                            </div>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Materi promosi yang terpasang di outlet. Ubah bila brandingnya berganti.
                        </p>

                        <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Branding Terpasang</p>
                            <p className="mt-1 font-semibold text-gray-950">{String(data.outlet.branding || "-")}</p>
                        </div>

                        <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm leading-6 text-muted-foreground">
                            Kunjungan salesforce dianggap terealisasi bila keempat foto diperbarui pada minggu
                            berjalan. <strong className="text-gray-950">Titik lokasi tidak perlu ditandai setiap
                            kunjungan</strong> -- cukup sekali saat outlet belum punya titik, atau saat outlet pindah
                            dan titiknya keliru.
                        </p>
                    </div>
                </div>

                {/* 8. Riwayat perubahan */}
                <div className="rounded-lg border bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-red-600" />
                        <h2 className="font-bold">Riwayat Perubahan</h2>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Perubahan foto, lokasi, profil, dan branding, baik oleh mitra maupun admin.</p>

                    {data.editLogs?.length ? (
                        <ul className="mt-4 space-y-2">
                            {data.editLogs.map((log) => (
                                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-gray-50 px-4 py-3 text-sm">
                                    <span className="flex items-center gap-2">
                                        {ikonRiwayat(log.action)}
                                        <span className="font-semibold text-gray-950">{labelRiwayat(log.action)}</span>
                                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-gray-200">
                                            {log.actorLabel}
                                        </span>
                                    </span>
                                    <span className="text-xs text-muted-foreground">{formatWaktu(log.createdAt)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-4 text-sm text-muted-foreground">Belum ada perubahan yang tercatat.</p>
                    )}
                </div>
            </section>
        </main>
    );
}

function formatWaktu(value: string) {
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(value));
}

function ikonRiwayat(action: EditLog["action"]) {
    if (action === "PHOTO") return <Camera className="h-4 w-4 text-muted-foreground" />;
    if (action === "BRANDING") return <Tag className="h-4 w-4 text-muted-foreground" />;
    if (action === "PROFILE") return <Pencil className="h-4 w-4 text-muted-foreground" />;
    return <MapPin className="h-4 w-4 text-muted-foreground" />;
}

function labelRiwayat(action: EditLog["action"]) {
    if (action === "PHOTO") return "Foto outlet diperbarui";
    if (action === "BRANDING") return "Branding outlet diperbarui";
    if (action === "PROFILE") return "Profil outlet diperbarui";
    return "Lokasi outlet diperbarui";
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

