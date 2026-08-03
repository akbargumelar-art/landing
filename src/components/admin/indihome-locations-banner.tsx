"use client";

import React from "react";
import { Image as ImageIcon, Loader2, MapPin, Plus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LocationRow {
    id: string;
    name: string;
    isActive: boolean;
    sortOrder: number;
}

interface BannerRow {
    id: string;
    imageUrl: string;
    headline: string;
    subheadline: string;
    ctaText: string;
    ctaLink: string;
    isActive: boolean;
    sortOrder: number;
}

const emptyBanner = {
    imageUrl: "",
    headline: "",
    subheadline: "",
    ctaText: "Lihat paket tersedia",
    ctaLink: "#paket",
};

export function IndihomeLocationsBanner() {
    const [locations, setLocations] = React.useState<LocationRow[]>([]);
    const [banners, setBanners] = React.useState<BannerRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [message, setMessage] = React.useState("");
    const [newLocation, setNewLocation] = React.useState("");
    const [savingLocation, setSavingLocation] = React.useState(false);
    const [bannerDraft, setBannerDraft] = React.useState(emptyBanner);
    const [uploading, setUploading] = React.useState(false);
    const [savingBanner, setSavingBanner] = React.useState(false);

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const [locRes, banRes] = await Promise.all([
                fetch("/api/admin/indihome/locations"),
                fetch("/api/admin/indihome/banner"),
            ]);
            const locData = await locRes.json();
            const banData = await banRes.json();
            if (!locRes.ok) throw new Error(locData.error || "Lokasi gagal dimuat.");
            if (!banRes.ok) throw new Error(banData.error || "Banner gagal dimuat.");
            setLocations(locData.locations || []);
            setBanners(banData.banners || []);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Data gagal dimuat.");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { load(); }, [load]);

    async function addLocation(event: React.FormEvent) {
        event.preventDefault();
        setSavingLocation(true);
        setMessage("");
        try {
            const response = await fetch("/api/admin/indihome/locations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newLocation, sortOrder: locations.length }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Lokasi gagal disimpan.");
            setNewLocation("");
            await load();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Lokasi gagal disimpan.");
        } finally {
            setSavingLocation(false);
        }
    }

    async function toggleLocation(row: LocationRow) {
        const response = await fetch(`/api/admin/indihome/locations/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !row.isActive }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setMessage(data.error || "Gagal mengubah status lokasi.");
            return;
        }
        load();
    }

    async function removeLocation(row: LocationRow) {
        if (!window.confirm(`Hapus lokasi ${row.name}?`)) return;
        const response = await fetch(`/api/admin/indihome/locations/${row.id}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setMessage(data.error || "Lokasi gagal dihapus.");
            return;
        }
        setMessage("");
        load();
    }

    async function uploadBannerImage() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;
            setUploading(true);
            setMessage("");
            try {
                const formData = new FormData();
                formData.append("file", file);
                const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
                const data = await response.json();
                if (!response.ok || !data.url) throw new Error(data.error || "Gambar gagal diunggah.");
                setBannerDraft((current) => ({ ...current, imageUrl: data.url }));
            } catch (error) {
                setMessage(error instanceof Error ? error.message : "Gambar gagal diunggah.");
            } finally {
                setUploading(false);
            }
        };
        input.click();
    }

    async function saveBanner(event: React.FormEvent) {
        event.preventDefault();
        setSavingBanner(true);
        setMessage("");
        try {
            const response = await fetch("/api/admin/indihome/banner", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...bannerDraft, sortOrder: 0, isActive: true }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Banner gagal disimpan.");
            setBannerDraft(emptyBanner);
            await load();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Banner gagal disimpan.");
        } finally {
            setSavingBanner(false);
        }
    }

    async function toggleBanner(row: BannerRow) {
        const response = await fetch(`/api/admin/indihome/banner/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !row.isActive }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setMessage(data.error || "Gagal mengubah status banner.");
            return;
        }
        load();
    }

    async function removeBanner(row: BannerRow) {
        if (!window.confirm("Hapus banner ini?")) return;
        const response = await fetch(`/api/admin/indihome/banner/${row.id}`, { method: "DELETE" });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setMessage(data.error || "Banner gagal dihapus.");
            return;
        }
        load();
    }

    if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div>;

    const activeBanner = banners.find((banner) => banner.isActive);

    return (
        <section className="space-y-6">
            {message && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{message}</div>}

            <Card>
                <CardContent className="p-5">
                    <h3 className="flex items-center gap-2 font-bold text-gray-950"><MapPin className="h-4 w-4" /> Lokasi Layanan</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Lokasi yang muncul di form pengajuan dan dipakai untuk cakupan paket.
                        Menonaktifkan lokasi menyembunyikannya dari pengunjung tanpa menghapus data pengajuan lama.
                    </p>

                    <form onSubmit={addLocation} className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Input
                            value={newLocation}
                            onChange={(event) => setNewLocation(event.target.value)}
                            placeholder="Contoh: Kabupaten Majalengka"
                            required
                            minLength={3}
                        />
                        <Button type="submit" disabled={savingLocation} className="bg-red-600 hover:bg-red-700">
                            {savingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Tambah lokasi
                        </Button>
                    </form>

                    <div className="mt-4 space-y-2">
                        {locations.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada lokasi.</p>
                        ) : locations.map((row) => (
                            <div key={row.id} className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-2.5">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-sm">{row.name}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                                        {row.isActive ? "Aktif" : "Nonaktif"}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => toggleLocation(row)}>
                                        {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => removeLocation(row)} title="Hapus lokasi">
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5">
                    <h3 className="flex items-center gap-2 font-bold text-gray-950"><ImageIcon className="h-4 w-4" /> Banner Halaman IndiHome</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Banner aktif dengan urutan terkecil yang ditampilkan di hero halaman publik.
                    </p>

                    {activeBanner && (
                        <div className="mt-4 overflow-hidden rounded-lg border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={activeBanner.imageUrl} alt="Banner aktif" className="h-40 w-full object-cover" />
                            <div className="p-3">
                                <p className="text-sm font-semibold">{activeBanner.headline || "(tanpa headline)"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{activeBanner.subheadline}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={saveBanner} className="mt-5 space-y-4">
                        <div className="space-y-2">
                            <Label>Gambar banner</Label>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button type="button" variant="outline" onClick={uploadBannerImage} disabled={uploading}>
                                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    Unggah gambar
                                </Button>
                                {bannerDraft.imageUrl && <span className="text-xs text-muted-foreground break-all">{bannerDraft.imageUrl}</span>}
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="banner-headline">Headline</Label>
                                <Input id="banner-headline" value={bannerDraft.headline} onChange={(event) => setBannerDraft({ ...bannerDraft, headline: event.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="banner-sub">Subheadline</Label>
                                <Input id="banner-sub" value={bannerDraft.subheadline} onChange={(event) => setBannerDraft({ ...bannerDraft, subheadline: event.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="banner-cta">Teks tombol</Label>
                                <Input id="banner-cta" value={bannerDraft.ctaText} onChange={(event) => setBannerDraft({ ...bannerDraft, ctaText: event.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="banner-cta-link">Tautan tombol</Label>
                                <Input id="banner-cta-link" value={bannerDraft.ctaLink} onChange={(event) => setBannerDraft({ ...bannerDraft, ctaLink: event.target.value })} />
                            </div>
                        </div>
                        <Button type="submit" disabled={savingBanner || !bannerDraft.imageUrl} className="bg-red-600 hover:bg-red-700">
                            {savingBanner ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Simpan banner baru
                        </Button>
                    </form>

                    {banners.length > 1 && (
                        <div className="mt-6 space-y-2">
                            <p className="text-sm font-semibold">Semua banner</p>
                            {banners.map((row) => (
                                <div key={row.id} className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-2.5">
                                    <span className="truncate text-sm">{row.headline || row.imageUrl}</span>
                                    <div className="flex shrink-0 gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                                            {row.isActive ? "Aktif" : "Nonaktif"}
                                        </span>
                                        <Button variant="outline" size="sm" onClick={() => toggleBanner(row)}>
                                            {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => removeBanner(row)} title="Hapus banner">
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </section>
    );
}
