"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React from "react";
import { ArrowLeft, Camera, Crosshair, History, Loader2, MapPin, ShieldCheck } from "lucide-react";

import { OutletPhotoCard } from "@/components/mitra/outlet-photo-card";
import { Button } from "@/components/ui/button";
import type { MitraPhotoSlotKey } from "@/lib/mitra-outlet-photos";
import { MITRA_DETAIL_FIELD_GROUPS } from "@/lib/mitra-fields";
import { MITRA_MARKET_SHARE_OPERATORS, type MitraMarketShareKey } from "@/lib/mitra-market-share";

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
    marketShare: (Record<MitraMarketShareKey, string> & { kabupaten: string; kecamatan: string }) | null;
    editLogs: EditLog[];
}

interface EditLog {
    id: string;
    action: "PHOTO" | "LOCATION";
    actorType: "MITRA" | "ADMIN";
    actorLabel: string;
    createdAt: string;
}

export default function MitraOutletDetailPage() {
    const params = useParams();
    const publicToken = String(params.publicToken || "");
    const [data, setData] = React.useState<DetailData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [mengunggah, setMengunggah] = React.useState<MitraPhotoSlotKey | null>(null);
    const [menandaiLokasi, setMenandaiLokasi] = React.useState(false);
    const [pesan, setPesan] = React.useState<{ ok: boolean; teks: string } | null>(null);

    const muat = React.useCallback(() => {
        return fetch(`/api/public/mitra/outlets/${publicToken}/detail`)
            .then((res) => res.ok ? res.json() : null)
            .then(setData);
    }, [publicToken]);

    React.useEffect(() => {
        muat().finally(() => setLoading(false));
    }, [muat]);

    const unggahFoto = async (slot: MitraPhotoSlotKey, file: File) => {
        setMengunggah(slot);
        setPesan(null);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("slot", slot);

        try {
            const res = await fetch(`/api/public/mitra/outlets/${publicToken}/photo`, { method: "POST", body: fd });
            const hasil = await res.json().catch(() => ({}));
            if (!res.ok) {
                setPesan({ ok: false, teks: hasil.error || "Foto gagal diunggah." });
            } else {
                setPesan({ ok: true, teks: "Foto outlet berhasil diperbarui." });
                await muat();
            }
        } catch {
            setPesan({ ok: false, teks: "Koneksi bermasalah saat mengunggah foto." });
        } finally {
            setMengunggah(null);
        }
    };

    /**
     * Koordinat diambil dari GPS perangkat, bukan diketik. Mengetik lintang/bujur manual
     * adalah sumber titik outlet yang meleset -- satu digit tertukar sudah memindahkan
     * penanda belasan kilometer, dan tidak ada cara memverifikasinya dari layar admin.
     */
    const tandaiLokasi = () => {
        if (!navigator.geolocation) {
            setPesan({ ok: false, teks: "Perangkat atau browser ini tidak mendukung penanda lokasi." });
            return;
        }

        setMenandaiLokasi(true);
        setPesan(null);

        navigator.geolocation.getCurrentPosition(
            async (posisi) => {
                try {
                    const res = await fetch(`/api/public/mitra/outlets/${publicToken}/location`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            latitude: posisi.coords.latitude,
                            longitude: posisi.coords.longitude,
                            accuracy: posisi.coords.accuracy,
                        }),
                    });
                    const hasil = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        setPesan({ ok: false, teks: hasil.error || "Lokasi gagal disimpan." });
                    } else {
                        setPesan({ ok: true, teks: `Lokasi outlet diperbarui (ketelitian ±${Math.round(posisi.coords.accuracy)} m).` });
                        await muat();
                    }
                } catch {
                    setPesan({ ok: false, teks: "Koneksi bermasalah saat menyimpan lokasi." });
                } finally {
                    setMenandaiLokasi(false);
                }
            },
            (error) => {
                setMenandaiLokasi(false);
                setPesan({
                    ok: false,
                    teks: error.code === error.PERMISSION_DENIED
                        ? "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini lalu coba lagi."
                        : "Lokasi tidak terbaca. Pastikan GPS aktif dan Anda berada di depan outlet.",
                });
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

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
                        <Info label="Nama Owner" value={String(data.outlet.ownerName || "-")} />
                        <Info label="Nomor Owner" value={data.details.ownerPhone || "-"} />
                        <Info label="Nomor RS" value={String(data.outlet.rsNumber || "-")} />
                        <Info label="TAP" value={String(data.outlet.tap || "-")} />
                        <Info label="Salesforce" value={String(data.outlet.salesforce || "-")} />
                        <Info label="Kabupaten" value={String(data.outlet.kabupaten || "-")} />
                        <Info label="Kecamatan" value={String(data.outlet.kecamatan || "-")} />
                    </div>

                    {data.outlet.locationUrl && (
                        <a href={String(data.outlet.locationUrl)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600">
                            <MapPin className="h-4 w-4" />
                            Buka lokasi outlet
                        </a>
                    )}
                </div>

                <OutletPhotoCard outlet={data.outlet} onUpload={unggahFoto} sedangUnggah={mengunggah} />

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-lg border bg-white p-5 shadow-sm">
                        <h2 className="font-bold">Lokasi Outlet</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">Diambil dari GPS perangkat, bukan diketik manual, supaya titiknya akurat.</p>

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

                        <Button onClick={tandaiLokasi} disabled={menandaiLokasi} className="mt-3 w-full">
                            {menandaiLokasi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                            {menandaiLokasi ? "Membaca lokasi..." : "Tandai Lokasi Saya Sekarang"}
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Tekan tombol ini <strong>saat berada di depan outlet</strong>. Koordinat dengan ketelitian di atas 200 m akan ditolak.
                        </p>
                    </div>

                    <div className="rounded-lg border bg-white p-5 shadow-sm">
                        <h2 className="font-bold">Validasi Kunjungan</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Kunjungan salesforce dianggap terealisasi bila keempat foto diperbarui pada minggu berjalan.
                        </p>
                        <p className="mt-4 text-sm leading-6 text-muted-foreground">
                            Perbarui foto langsung dari lokasi outlet memakai kamera perangkat, lalu tandai titik lokasi.
                            Setiap perubahan tercatat pada riwayat di bawah beserta nomor yang melakukannya.
                        </p>
                    </div>
                </div>

                {pesan && (
                    <p className={`rounded-lg p-3 text-sm ${pesan.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        {pesan.teks}
                    </p>
                )}

                <div className="rounded-lg border bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-bold">Market Share Kecamatan</h2>
                        <p className="text-xs text-muted-foreground">
                            {data.marketShare
                                ? `${data.marketShare.kecamatan}, ${data.marketShare.kabupaten}`
                                : "Angka wilayah, bukan angka outlet ini"}
                        </p>
                    </div>

                    {data.marketShare ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {MITRA_MARKET_SHARE_OPERATORS.map((operator) => {
                                const percent = Number(data.marketShare?.[operator.key] ?? 0);
                                return (
                                    <div key={operator.key} className="rounded-lg border bg-gray-50 p-3">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <p className="text-xs font-semibold text-gray-700">{operator.label}</p>
                                            <p className="text-base font-bold tabular-nums text-gray-950">
                                                {percent.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%
                                            </p>
                                        </div>
                                        {/* Lebar bar dipotong di 100% supaya data keliru (mis. 250) tidak
                                            merusak tata letak kartu di sebelahnya. */}
                                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                                            <div
                                                className="h-full rounded-full"
                                                style={{ width: `${Math.min(Math.max(percent, 0), 100)}%`, background: operator.color }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-muted-foreground">
                            Belum ada data market share untuk kecamatan ini.
                        </p>
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
                <div className="rounded-lg border bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-red-600" />
                        <h2 className="font-bold">Riwayat Perubahan</h2>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Perubahan foto dan lokasi, baik oleh mitra maupun admin.</p>

                    {data.editLogs?.length ? (
                        <ul className="mt-4 space-y-2">
                            {data.editLogs.map((log) => (
                                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-gray-50 px-4 py-3 text-sm">
                                    <span className="flex items-center gap-2">
                                        {log.action === "PHOTO" ? <Camera className="h-4 w-4 text-muted-foreground" /> : <MapPin className="h-4 w-4 text-muted-foreground" />}
                                        <span className="font-semibold text-gray-950">
                                            {log.action === "PHOTO" ? "Foto outlet diperbarui" : "Lokasi outlet diperbarui"}
                                        </span>
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

function formatWaktu(value: string) {
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(value));
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
