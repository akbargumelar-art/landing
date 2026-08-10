"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import { CheckCircle2, LockKeyhole, MapPin, MessageCircle, QrCode, Send, ShieldAlert, User } from "lucide-react";

import { BackLink } from "@/components/back-link";
import { InfoCard } from "@/components/mitra/info-card";
import { OutletPhotoCard } from "@/components/mitra/outlet-photo-card";
import { PetaSekitar } from "@/components/mitra/peta-sekitar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PublicOutlet extends Record<string, unknown> {
    publicToken: string;
    outletCode: string;
    name: string;
    kabupaten: string;
    kecamatan: string;
    category: string;
    pjpDay: string;
    pjpType: string;
    branding: string;
    status: string;
    photoUrl?: string;
    tap?: string;
    salesforce?: string;
    salesforcePhotoUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    salesforcePhoneMasked?: string | null;
    salesforceWaUrl?: string | null;
    ownerPhoneMasked: string;
}

export default function MitraOutletProfilePage() {
    const params = useParams();
    const router = useRouter();
    const publicToken = String(params.publicToken || "");
    const [outlet, setOutlet] = React.useState<PublicOutlet | null>(null);
    const [phone, setPhone] = React.useState("");
    const [code, setCode] = React.useState("");
    const [error, setError] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);
    const [notice, setNotice] = React.useState<{ eligible: boolean; title: string; message: string } | null>(null);

    React.useEffect(() => {
        fetch(`/api/public/mitra/outlets/${publicToken}`)
            .then((res) => res.ok ? res.json() : null)
            .then((data) => setOutlet(data?.outlet || null))
            .finally(() => setLoading(false));
    }, [publicToken]);

    // Hasil permintaan OTP muncul sebagai popup, bukan teks kecil di bawah tombol:
    // status "berhak" atau "tidak berhak" adalah info yang menentukan langkah pengunjung
    // berikutnya, jadi harus sulit terlewat.
    const requestOtp = async () => {
        setSubmitting(true);
        setError("");
        try {
            const res = await fetch(`/api/public/mitra/outlets/${publicToken}/otp/request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            });
            const data = await res.json().catch(() => ({}));
            setNotice({
                eligible: res.ok && Boolean(data.eligible),
                title: data.title || "Permintaan OTP Gagal",
                message: data.message || "Permintaan OTP gagal diproses. Coba lagi beberapa saat.",
            });
        } catch {
            setNotice({
                eligible: false,
                title: "Koneksi Bermasalah",
                message: "Permintaan tidak sampai ke server. Periksa jaringan Anda lalu coba lagi.",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const verifyOtp = async () => {
        setSubmitting(true);
        setError("");
        const res = await fetch(`/api/public/mitra/outlets/${publicToken}/otp/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, code }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.detailUrl) router.push(data.detailUrl);
        else setError(data.error || "Kode OTP tidak valid");
        setSubmitting(false);
    };

    // Tautan kembali ikut ditampilkan pada state memuat dan tidak ditemukan. Tanpa itu
    // outlet yang tokennya salah atau sudah dihapus menjadi jalan buntu total.
    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50">
                <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                    <BackLink href="/mitra" label="Kembali ke Direktori Outlet" />
                    <p className="mt-8 text-center text-sm text-muted-foreground">Memuat profil outlet...</p>
                </section>
            </main>
        );
    }

    if (!outlet) {
        return (
            <main className="min-h-screen bg-gray-50">
                <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                    <BackLink href="/mitra" label="Kembali ke Direktori Outlet" />
                    <p className="mt-8 text-center text-sm text-muted-foreground">Outlet tidak ditemukan.</p>
                </section>
            </main>
        );
    }

    const canVerify = code.length === 6 && Boolean(phone);

    return (
        <main className="min-h-screen bg-gray-50">
            <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
                <BackLink href="/mitra" label="Kembali ke Direktori Outlet" />
            </section>
            <section className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
                <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                    <div className="relative h-48 bg-gradient-to-br from-red-600 to-orange-500">
                        {outlet.photoUrl && (
                            <Image src={outlet.photoUrl} alt={outlet.name} fill className="object-cover" unoptimized />
                        )}
                        <div className="absolute inset-0 bg-black/25" />
                        <div className="absolute bottom-5 left-5 right-5 text-white">
                            <Badge className="mb-3 bg-white text-red-600 hover:bg-white">{outlet.status}</Badge>
                            <h1 className="text-2xl font-extrabold">{outlet.name}</h1>
                            <p className="mt-1 text-sm text-white/85">{outlet.outletCode}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-5">
                        <InfoCard label="Wilayah" value={`${outlet.kecamatan}, ${outlet.kabupaten}`} icon={<MapPin className="h-4 w-4" />} />
                        <InfoCard label="TAP" value={outlet.tap || "-"} />
                        <InfoCard label="Kategori" value={outlet.category} />
                        <InfoCard label="Jadwal PJP" value={`${outlet.pjpDay} / ${outlet.pjpType}`} />
                        <InfoCard label="Branding" value={outlet.branding || "-"} />
                        <InfoCard label="Nomor Owner" value={outlet.ownerPhoneMasked} />
                        <SalesforceInfo
                            name={outlet.salesforce}
                            photoUrl={outlet.salesforcePhotoUrl}
                            phoneMasked={outlet.salesforcePhoneMasked}
                            waUrl={outlet.salesforceWaUrl}
                        />
                    </div>
                    {/* Kartu foto ikut tampil sebelum OTP: foto outlet bukan data terkunci,
                        dan kebaruannya justru yang ingin dilihat pengunjung. */}
                    {/* "Lokasi akurat" dihapus dari kalimat ini: sejak peta sebaran di /mitra
                        menampilkan koordinat outlet secara publik, menjanjikannya sebagai data
                        terkunci tidak lagi benar. Yang masih benar-benar di balik OTP adalah
                        detail owner dan angka performa. */}
                    <div className="border-t p-5 text-sm text-muted-foreground">
                        Detail owner dan performansi hanya tersedia setelah OTP WhatsApp berhasil diverifikasi.
                    </div>
                </div>

                <aside className="rounded-lg border bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-red-600">
                            <LockKeyhole className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-bold">Buka Detail Outlet</h2>
                            <p className="text-xs text-muted-foreground">Verifikasi nomor whitelist.</p>
                        </div>
                    </div>

                    <div className="mt-5 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Nomor WhatsApp</Label>
                            <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" />
                        </div>
                        <Button onClick={requestOtp} disabled={submitting || !phone} className="w-full">
                            <Send className="h-4 w-4" />
                            Kirim OTP
                        </Button>

                        <div className="space-y-2">
                            <Label htmlFor="code">Kode OTP</Label>
                            <Input id="code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digit" inputMode="numeric" />
                            <p className="text-xs text-muted-foreground">Kode berlaku 5 menit sejak dikirim. Setelah terverifikasi, akses detail outlet tidak dibatasi waktu.</p>
                        </div>
                        {/* Warna tombol berubah begitu 6 digit terisi supaya jelas bahwa
                            langkah verifikasi sudah bisa dijalankan. */}
                        <Button
                            onClick={verifyOtp}
                            disabled={submitting || !canVerify}
                            variant={canVerify ? "default" : "outline"}
                            className={canVerify ? "w-full bg-green-600 text-white shadow-md hover:bg-green-700" : "w-full"}
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Verifikasi
                        </Button>

                        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

                        {/* download + ?dl=1: berkas tersimpan langsung dan pengunjung tetap di
                            halaman ini. Sebelumnya tautan ini membuka SVG mentah yang tidak
                            punya jalan kembali ke profil outlet. */}
                        <a
                            href={`/api/public/mitra/outlets/${publicToken}/qr?dl=1`}
                            download={`qr-${outlet.outletCode}.svg`}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
                        >
                            <QrCode className="h-4 w-4" />
                            Download QR SVG
                        </a>
                    </div>
                </aside>
            </section>

            <section className="mx-auto max-w-6xl space-y-6 px-4 pb-6 sm:px-6 lg:px-8">
                <OutletPhotoCard outlet={outlet} />

                {/* Peta sekitar ikut tampil sebelum OTP. Yang dibuka hanya sebaran titiknya --
                    koordinat outlet memang sudah publik di direktori /mitra, dan titik ODP
                    dikirim tanpa nama maupun kapasitas port. Rincian ODP tetap di balik OTP. */}
                {outlet.latitude != null && outlet.longitude != null && (
                    <PetaSekitar
                        outlet={{
                            publicToken: outlet.publicToken,
                            outletCode: outlet.outletCode,
                            name: outlet.name,
                            kabupaten: outlet.kabupaten,
                            kecamatan: outlet.kecamatan,
                            latitude: Number(outlet.latitude),
                            longitude: Number(outlet.longitude),
                        }}
                    />
                )}
            </section>

            <Dialog open={Boolean(notice)} onOpenChange={(open) => { if (!open) setNotice(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <div className={`mb-2 flex h-11 w-11 items-center justify-center rounded-full ${notice?.eligible ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                            {notice?.eligible ? <MessageCircle className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                        </div>
                        <DialogTitle>{notice?.title}</DialogTitle>
                        <DialogDescription>{notice?.message}</DialogDescription>
                    </DialogHeader>
                    <Button onClick={() => setNotice(null)} className="w-full">Mengerti</Button>
                </DialogContent>
            </Dialog>
        </main>
    );
}

/**
 * Foto salesforce digeser ke atas supaya kepalanya menyembul dari lingkaran. Ketiga angka
 * di bawah harus tetap sejalan: garis potong salinan yang menyembul dihitung dari geseran
 * dan tinggi fotonya, bukan diketik terpisah. Ketika garis potong jatuh di bawah tepi atas
 * lingkaran, sisa gambarnya tergambar sebagai kotak persegi yang menutupi bingkai putih dan
 * caption di atasnya -- persis keluhan "caption tertutup blok kotak". Dengan rumus ini
 * potongannya berhenti tepat di tepi lingkaran, sehingga yang menutupi caption hanya piksel
 * fotonya sendiri (foto salesforce diunggah dengan latar transparan).
 */
const FOTO_GESER_ATAS = 18; // persen tinggi kotak avatar
const FOTO_TINGGI = 118;    // persen tinggi kotak avatar
const FOTO_POTONG = (FOTO_GESER_ATAS / FOTO_TINGGI) * 100;

// Salesforce dapat kartunya sendiri (selebar dua kolom) karena hanya kolom ini yang
// membawa foto; menaruhnya di grid Info biasa akan membuat satu sel jauh lebih tinggi
// daripada tetangganya. Tanpa foto, inisial nama dipakai sebagai penggantinya.
function SalesforceInfo({ name, photoUrl, phoneMasked, waUrl }: {
    name?: string;
    photoUrl?: string | null;
    phoneMasked?: string | null;
    waUrl?: string | null;
}) {
    const displayName = name?.trim() || "-";
    const initials = displayName === "-"
        ? ""
        : displayName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

    return (
        <div className="col-span-2 rounded-lg border bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nama Salesforce</p>
            <div className="mt-3 flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24">
                    {photoUrl ? (
                        <>
                            <div className="absolute inset-0 overflow-hidden rounded-full bg-white">
                                <Image
                                    src={photoUrl}
                                    alt={displayName}
                                    width={96}
                                    height={113}
                                    sizes="96px"
                                    className="absolute left-0 w-full max-w-none object-cover object-top"
                                    style={{ top: `-${FOTO_GESER_ATAS}%`, height: `${FOTO_TINGGI}%` }}
                                    unoptimized
                                />
                            </div>
                            <div className="pointer-events-none absolute inset-0 z-[1] rounded-full border-2 border-white shadow-sm" />
                            {/* Salinan yang menyembul dipotong tepat di tepi atas lingkaran secara vertikal
                                (garis potong dihitung dari geser/tinggi supaya tidak ada sisa kotak yang
                                menutupi caption -- itu bug sebelumnya). Ke samping sengaja dipersempit
                                10%-90%: lingkaran hanya membuka celah sempit di titik teratasnya, jadi
                                sembulan selebar penuh kotak muncul sebagai potongan rata di dahi begitu
                                bersambung dengan lingkaran. Dipersempit, sambungannya mengikuti bentuk
                                kepala, bukan blok persegi. */}
                            <Image
                                src={photoUrl}
                                alt=""
                                aria-hidden="true"
                                width={96}
                                height={113}
                                sizes="96px"
                                className="pointer-events-none absolute left-0 z-[2] w-full max-w-none object-cover object-top"
                                style={{
                                    top: `-${FOTO_GESER_ATAS}%`,
                                    height: `${FOTO_TINGGI}%`,
                                    clipPath: `polygon(10% 0, 90% 0, 90% ${FOTO_POTONG}%, 10% ${FOTO_POTONG}%)`,
                                }}
                                unoptimized
                            />
                        </>
                    ) : (
                        <span className="flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-white text-xl font-bold text-muted-foreground shadow-sm">
                            {initials || <User className="h-8 w-8" />}
                        </span>
                    )}
                </div>
                <div className="min-w-0">
                    <p className="text-lg font-semibold text-gray-950">{displayName}</p>
                    {phoneMasked && <p className="mt-0.5 text-sm text-muted-foreground">{phoneMasked}</p>}

                    {waUrl && (
                        <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                        >
                            <MessageCircle className="h-4 w-4" />
                            Kirim WhatsApp
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

