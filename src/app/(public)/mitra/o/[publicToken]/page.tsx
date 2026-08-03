"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import { CheckCircle2, LockKeyhole, MapPin, QrCode, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PublicOutlet {
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
    territoryName?: string;
    ownerPhoneMasked: string;
}

export default function MitraOutletProfilePage() {
    const params = useParams();
    const router = useRouter();
    const publicToken = String(params.publicToken || "");
    const [outlet, setOutlet] = React.useState<PublicOutlet | null>(null);
    const [phone, setPhone] = React.useState("");
    const [code, setCode] = React.useState("");
    const [message, setMessage] = React.useState("");
    const [error, setError] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        fetch(`/api/public/mitra/outlets/${publicToken}`)
            .then((res) => res.ok ? res.json() : null)
            .then((data) => setOutlet(data?.outlet || null))
            .finally(() => setLoading(false));
    }, [publicToken]);

    const requestOtp = async () => {
        setSubmitting(true);
        setError("");
        const res = await fetch(`/api/public/mitra/outlets/${publicToken}/otp/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
        });
        const data = await res.json().catch(() => ({}));
        setMessage(data.message || "Jika nomor terdaftar, OTP akan dikirim.");
        if (!res.ok && res.status !== 429) setError(data.error || "Gagal meminta OTP");
        setSubmitting(false);
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

    if (loading) {
        return <main className="min-h-screen bg-gray-50 pt-24 text-center text-sm text-muted-foreground">Memuat profil outlet...</main>;
    }

    if (!outlet) {
        return <main className="min-h-screen bg-gray-50 pt-24 text-center text-sm text-muted-foreground">Outlet tidak ditemukan.</main>;
    }

    return (
        <main className="min-h-screen bg-gray-50 pt-20">
            <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
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
                    <div className="grid gap-4 p-5 sm:grid-cols-2">
                        <Info label="Wilayah" value={`${outlet.kecamatan}, ${outlet.kabupaten}`} icon={<MapPin className="h-4 w-4" />} />
                        <Info label="Territory" value={outlet.territoryName || "-"} />
                        <Info label="Kategori" value={outlet.category} />
                        <Info label="Jadwal PJP" value={`${outlet.pjpDay} / ${outlet.pjpType}`} />
                        <Info label="Branding" value={outlet.branding || "-"} />
                        <Info label="Nomor Owner" value={outlet.ownerPhoneMasked} />
                    </div>
                    <div className="border-t p-5 text-sm text-muted-foreground">
                        Detail owner, lokasi akurat, dan performansi hanya tersedia setelah OTP WhatsApp berhasil diverifikasi.
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
                        </div>
                        <Button onClick={verifyOtp} disabled={submitting || code.length !== 6 || !phone} variant="outline" className="w-full">
                            <CheckCircle2 className="h-4 w-4" />
                            Verifikasi
                        </Button>

                        {message && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{message}</p>}
                        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

                        <Link href={`/api/public/mitra/outlets/${publicToken}/qr`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold">
                            <QrCode className="h-4 w-4" />
                            Download QR SVG
                        </Link>
                    </div>
                </aside>
            </section>
        </main>
    );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="rounded-lg border bg-gray-50 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{icon}{label}</p>
            <p className="mt-1 font-semibold text-gray-950">{value}</p>
        </div>
    );
}
