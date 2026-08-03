"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
    ArrowRight,
    Check,
    CheckCircle2,
    Loader2,
    MapPin,
    PhoneCall,
    Router,
    Send,
    ShieldCheck,
    Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    INDIHOME_LOCATIONS,
    INDIHOME_PRODUCTS,
    type IndihomeProduct,
} from "@/lib/indihome-products";

const currency = new Intl.NumberFormat("id-ID");

type FormState = {
    fullName: string;
    phone: string;
    email: string;
    district: string;
    address: string;
    consent: boolean;
    company: string;
};

const initialForm: FormState = {
    fullName: "",
    phone: "",
    email: "",
    district: "",
    address: "",
    consent: false,
    company: "",
};

export function IndihomePlansAndForm() {
    const [locations, setLocations] = useState<string[]>([...INDIHOME_LOCATIONS]);
    const [location, setLocation] = useState<string>(INDIHOME_LOCATIONS[0]);
    const [packageId, setPackageId] = useState("internet-100");
    const [products, setProducts] = useState<IndihomeProduct[]>(INDIHOME_PRODUCTS);
    const [form, setForm] = useState<FormState>(initialForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [reference, setReference] = useState("");

    const availableProducts = useMemo(
        () => products.filter((product) => product.locations.includes(location)),
        [location, products],
    );

    const selectedProduct = availableProducts.find((product) => product.id === packageId)
        ?? availableProducts[0];

    useEffect(() => {
        fetch("/api/public/indihome/products")
            .then((response) => response.ok ? response.json() : null)
            .then((data) => {
                if (Array.isArray(data?.products) && data.products.length > 0) {
                    setProducts(data.products);
                }
                if (Array.isArray(data?.locations) && data.locations.length > 0) {
                    setLocations(data.locations);
                    // The default selection came from the constants; move to a live one if
                    // the configured areas no longer include it.
                    setLocation((current) => data.locations.includes(current) ? current : data.locations[0]);
                }
            })
            .catch(() => undefined);
    }, []);

    function updateLocation(nextLocation: string) {
        setLocation(nextLocation);
        const stillAvailable = products.some(
            (product) => product.id === packageId && product.locations.includes(nextLocation),
        );
        if (!stillAvailable) {
            const firstAvailable = products.find((product) => product.locations.includes(nextLocation));
            if (firstAvailable) setPackageId(firstAvailable.id);
        }
    }

    function selectPackage(nextPackageId: string) {
        setPackageId(nextPackageId);
        setReference("");
        window.setTimeout(() => {
            document.getElementById("pengajuan")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
    }

    async function submitLead(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedProduct) return;

        setSubmitting(true);
        setError("");
        setReference("");

        try {
            const response = await fetch("/api/public/indihome/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    location,
                    packageId: selectedProduct.id,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Pengajuan gagal dikirim.");

            setReference(result.reference);
            setForm(initialForm);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Pengajuan gagal dikirim.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <section id="paket" className="scroll-mt-20 bg-white py-16 sm:py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="max-w-2xl">
                        <p className="text-sm font-bold uppercase text-red-600">Paket di lokasi Anda</p>
                        <h2 className="mt-2 text-3xl font-extrabold text-gray-950 sm:text-4xl">
                            Pilih internet rumah yang pas
                        </h2>
                        <p className="mt-4 text-base leading-7 text-gray-600">
                            Tentukan kabupaten atau kota pemasangan untuk melihat pilihan paket yang tersedia.
                        </p>
                    </div>

                    <div className="mt-8 max-w-md">
                        <Label htmlFor="location-filter" className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <MapPin className="h-4 w-4 text-red-600" aria-hidden="true" />
                            Kabupaten / Kota
                        </Label>
                        <select
                            id="location-filter"
                            value={location}
                            onChange={(event) => updateLocation(event.target.value)}
                            className="h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        >
                            {locations.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                        {availableProducts.map((product) => {
                            const active = selectedProduct?.id === product.id;
                            return (
                                <article
                                    key={product.id}
                                    className={`relative flex min-h-[430px] flex-col rounded-lg border bg-white p-6 transition ${
                                        active ? "border-red-500 shadow-lg shadow-red-100" : "border-gray-200 shadow-sm hover:border-gray-300"
                                    }`}
                                >
                                    {product.featured && (
                                        <span className="absolute right-4 top-4 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                                            Terpopuler
                                        </span>
                                    )}
                                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-950 text-white">
                                        <Router className="h-5 w-5" aria-hidden="true" />
                                    </div>
                                    <p className="mt-6 text-sm font-semibold text-gray-500">Kecepatan hingga</p>
                                    <div className="mt-1 flex items-baseline gap-1 text-gray-950">
                                        <span className="text-4xl font-black">{product.speedMbps}</span>
                                        <span className="text-base font-bold">Mbps</span>
                                    </div>
                                    <h3 className="mt-5 text-lg font-bold text-gray-950">{product.name}</h3>
                                    <p className="mt-2 min-h-12 text-sm leading-6 text-gray-600">{product.description}</p>
                                    <ul className="mt-5 space-y-3">
                                        {product.features.map((feature) => (
                                            <li key={feature} className="flex gap-2 text-sm text-gray-700">
                                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-auto pt-7">
                                        <p className="text-xs font-semibold uppercase text-gray-500">Mulai dari</p>
                                        <p className="mt-1 text-2xl font-black text-gray-950">
                                            Rp{currency.format(product.monthlyPrice)}
                                            <span className="text-sm font-medium text-gray-500">/bulan</span>
                                        </p>
                                        <Button
                                            type="button"
                                            onClick={() => selectPackage(product.id)}
                                            variant={active ? "default" : "outline"}
                                            className={`mt-5 h-11 w-full rounded-lg ${active ? "bg-red-600 hover:bg-red-700" : "border-gray-300"}`}
                                        >
                                            {active ? "Paket dipilih" : "Pilih paket"}
                                            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <p className="mt-6 text-sm leading-6 text-gray-500">
                        Harga belum termasuk biaya lain yang mungkin berlaku. Ketersediaan jaringan dan harga akhir akan dikonfirmasi setelah pengecekan alamat.
                    </p>
                </div>
            </section>

            <section id="pengajuan" className="scroll-mt-20 border-t border-gray-200 bg-gray-50 py-16 sm:py-20">
                <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8">
                    <div className="lg:pt-6">
                        <p className="text-sm font-bold uppercase text-red-600">Ajukan pemasangan</p>
                        <h2 className="mt-2 text-3xl font-extrabold text-gray-950 sm:text-4xl">
                            Kami bantu cek jaringan di alamat Anda
                        </h2>
                        <p className="mt-4 text-base leading-7 text-gray-600">
                            Isi data pemasangan. Tim kami akan menghubungi Anda melalui WhatsApp untuk konfirmasi cakupan dan proses berikutnya.
                        </p>
                        <div className="mt-8 space-y-5">
                            <div className="flex gap-4">
                                <Wifi className="mt-1 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                                <div>
                                    <p className="font-bold text-gray-950">Pengecekan jaringan</p>
                                    <p className="mt-1 text-sm leading-6 text-gray-600">Ketersediaan diverifikasi berdasarkan alamat pemasangan.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <PhoneCall className="mt-1 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                                <div>
                                    <p className="font-bold text-gray-950">Konfirmasi melalui WhatsApp</p>
                                    <p className="mt-1 text-sm leading-6 text-gray-600">Petugas menghubungi Anda untuk melengkapi proses berlangganan.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                                <div>
                                    <p className="font-bold text-gray-950">Data pengajuan terlindungi</p>
                                    <p className="mt-1 text-sm leading-6 text-gray-600">Data digunakan hanya untuk pengecekan dan tindak lanjut pemasangan.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
                        <div className="flex flex-col gap-2 border-b border-gray-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-500">Paket pilihan</p>
                                <p className="mt-1 font-bold text-gray-950">{selectedProduct?.name}</p>
                            </div>
                            <p className="text-sm font-semibold text-red-600">{location}</p>
                        </div>

                        {reference ? (
                            <div className="flex min-h-[460px] flex-col items-center justify-center text-center" role="status">
                                <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden="true" />
                                <h3 className="mt-5 text-2xl font-extrabold text-gray-950">Pengajuan sudah diterima</h3>
                                <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">
                                    Tim kami akan menghubungi Anda untuk pengecekan jaringan dan konfirmasi data.
                                </p>
                                <p className="mt-5 rounded-lg bg-gray-100 px-4 py-3 text-sm font-bold text-gray-800">
                                    Referensi: {reference}
                                </p>
                                <Button type="button" variant="outline" className="mt-6 rounded-lg" onClick={() => setReference("")}>
                                    Ajukan pemasangan lain
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={submitLead} className="mt-6 space-y-5">
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="fullName">Nama lengkap</Label>
                                        <Input id="fullName" name="fullName" autoComplete="name" required minLength={3} maxLength={255} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nama sesuai identitas" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Nomor WhatsApp</Label>
                                        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="08xxxxxxxxxx" />
                                    </div>
                                </div>
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email <span className="font-normal text-gray-500">(opsional)</span></Label>
                                        <Input id="email" name="email" type="email" autoComplete="email" maxLength={255} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nama@email.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="district">Kecamatan</Label>
                                        <Input id="district" name="district" autoComplete="address-level3" required minLength={3} maxLength={120} value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} placeholder="Kecamatan pemasangan" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">Alamat lengkap pemasangan</Label>
                                    <Textarea id="address" name="address" autoComplete="street-address" required minLength={10} maxLength={2000} rows={4} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Nama jalan, nomor rumah, kelurahan/desa, dan patokan" />
                                </div>
                                <div className="sr-only" aria-hidden="true">
                                    <Label htmlFor="company">Perusahaan</Label>
                                    <Input id="company" name="company" tabIndex={-1} autoComplete="off" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
                                </div>
                                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-gray-600">
                                    <input
                                        type="checkbox"
                                        required
                                        checked={form.consent}
                                        onChange={(event) => setForm({ ...form, consent: event.target.checked })}
                                        className="mt-1 h-4 w-4 shrink-0 accent-red-600"
                                    />
                                    <span>Saya menyetujui penggunaan data untuk pengecekan jaringan dan tindak lanjut pengajuan berlangganan.</span>
                                </label>
                                {error && (
                                    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
                                )}
                                <Button type="submit" disabled={submitting} className="h-12 w-full rounded-lg bg-red-600 text-base font-bold hover:bg-red-700">
                                    {submitting ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Mengirim pengajuan</>
                                    ) : (
                                        <><Send className="mr-2 h-4 w-4" aria-hidden="true" />Ajukan berlangganan</>
                                    )}
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}
