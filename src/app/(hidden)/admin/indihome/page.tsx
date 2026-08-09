"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, FileText, Loader2, MapPin, Pencil, Plus, Router, Search, Trash2, Wifi } from "lucide-react";
import { IndihomeLocationsBanner } from "@/components/admin/indihome-locations-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IndihomeOdpPanel } from "@/components/admin/indihome-odp-panel";
import { INDIHOME_LEAD_STATUSES, type IndihomeLeadStatus } from "@/lib/indihome-admin";
import { INDIHOME_LOCATIONS } from "@/lib/indihome-products";

type AdminProduct = {
    id: string;
    name: string;
    speedMbps: number;
    monthlyPrice: string;
    description: string;
    features: string[];
    locations: string[];
    isFeatured: boolean;
    isActive: boolean;
    sortOrder: number;
};

type ProductDraft = Omit<AdminProduct, "id" | "monthlyPrice" | "features"> & {
    id?: string;
    monthlyPrice: string | number;
    featuresText: string;
};

type IndihomeLead = {
    id: string;
    fullName: string;
    phoneE164: string;
    email: string | null;
    location: string;
    district: string;
    address: string;
    packageName: string;
    status: IndihomeLeadStatus;
    createdAt: string;
};

const emptyProduct: ProductDraft = {
    name: "",
    speedMbps: 100,
    monthlyPrice: 0,
    description: "",
    featuresText: "Internet fiber\nInstalasi dikonfirmasi petugas",
    locations: [...INDIHOME_LOCATIONS],
    isFeatured: false,
    isActive: true,
    sortOrder: 0,
};

const statusLabels: Record<IndihomeLeadStatus, string> = {
    NEW: "Baru",
    CONTACTED: "Sudah dihubungi",
    SURVEY: "Cek jaringan",
    SUBMITTED: "Diproses",
    CLOSED: "Selesai",
    CANCELLED: "Batal",
};

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function AdminIndihomePage() {
    const [tab, setTab] = useState<"products" | "leads" | "settings" | "odp">("products");
    const [locationOptions, setLocationOptions] = useState<string[]>([...INDIHOME_LOCATIONS]);
    const [products, setProducts] = useState<AdminProduct[]>([]);
    const [leads, setLeads] = useState<IndihomeLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [productDialog, setProductDialog] = useState(false);
    const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
    const [selectedLead, setSelectedLead] = useState<IndihomeLead | null>(null);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("");

    const loadProducts = useCallback(async () => {
        const response = await fetch("/api/admin/indihome/products");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Produk gagal dimuat.");
        setProducts(data.products || []);
    }, []);

    // Coverage areas are database-driven since Fase 4; the constant is only a fallback.
    const loadLocations = useCallback(async () => {
        const response = await fetch("/api/admin/indihome/locations");
        if (!response.ok) return;
        const data = await response.json();
        const names = (data.locations || [])
            .filter((row: { isActive: boolean }) => row.isActive)
            .map((row: { name: string }) => row.name);
        if (names.length > 0) setLocationOptions(names);
    }, []);

    const loadLeads = useCallback(async () => {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (statusFilter) params.set("status", statusFilter);
        if (locationFilter) params.set("location", locationFilter);
        const response = await fetch(`/api/admin/indihome/leads?${params}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Pengajuan gagal dimuat.");
        setLeads(data.leads || []);
    }, [locationFilter, query, statusFilter]);

    useEffect(() => {
        Promise.all([loadProducts(), loadLeads(), loadLocations()])
            .catch((error) => setMessage(error instanceof Error ? error.message : "Data gagal dimuat."))
            .finally(() => setLoading(false));
    }, [loadLeads, loadProducts, loadLocations]);

    function openAddProduct() {
        setDraft({ ...emptyProduct, locations: [...locationOptions] });
        setProductDialog(true);
        setMessage("");
    }

    function openEditProduct(product: AdminProduct) {
        setDraft({ ...product, featuresText: product.features.join("\n") });
        setProductDialog(true);
        setMessage("");
    }

    async function saveProduct(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setMessage("");
        const payload = {
            ...draft,
            features: draft.featuresText.split("\n").map((item) => item.trim()).filter(Boolean),
            speedMbps: Number(draft.speedMbps),
            monthlyPrice: Number(draft.monthlyPrice),
            sortOrder: Number(draft.sortOrder),
        };

        try {
            const response = await fetch(draft.id ? `/api/admin/indihome/products/${draft.id}` : "/api/admin/indihome/products", {
                method: draft.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Produk gagal disimpan.");
            await loadProducts();
            setProductDialog(false);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Produk gagal disimpan.");
        } finally {
            setSaving(false);
        }
    }

    async function deleteProduct(product: AdminProduct) {
        if (!window.confirm(`Hapus paket ${product.name}? Riwayat pengajuan lama tetap tersimpan.`)) return;
        const response = await fetch(`/api/admin/indihome/products/${product.id}`, { method: "DELETE" });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setMessage(data.error || "Produk gagal dihapus.");
            return;
        }
        await loadProducts();
    }

    async function updateLeadStatus(lead: IndihomeLead, status: IndihomeLeadStatus) {
        const response = await fetch(`/api/admin/indihome/leads/${lead.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        const data = await response.json();
        if (!response.ok) {
            setMessage(data.error || "Status gagal diperbarui.");
            return;
        }
        setLeads((current) => current.map((item) => item.id === lead.id ? data.lead : item));
        setSelectedLead((current) => current?.id === lead.id ? data.lead : current);
    }

    function toggleLocation(location: string) {
        setDraft((current) => ({
            ...current,
            locations: current.locations.includes(location)
                ? current.locations.filter((item) => item !== location)
                : [...current.locations, location],
        }));
    }

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-red-600" /></div>;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-950">Kelola IndiHome</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Atur katalog paket dan tindak lanjuti pengajuan dari landing page.</p>
                </div>
                <a href="/indihome" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Eye className="h-4 w-4" /> Lihat landing page</a>
            </div>

            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                <button type="button" onClick={() => setTab("products")} className={`flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold ${tab === "products" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}><Wifi className="h-4 w-4" /> Produk</button>
                <button type="button" onClick={() => setTab("settings")} className={`flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold ${tab === "settings" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}><MapPin className="h-4 w-4" /> Lokasi &amp; Banner</button>
                <button type="button" onClick={() => setTab("odp")} className={`flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold ${tab === "odp" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}><Router className="h-4 w-4" /> Titik ODP</button>
                <button type="button" onClick={() => setTab("leads")} className={`flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold ${tab === "leads" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}><FileText className="h-4 w-4" /> Form Langganan <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "leads" ? "bg-white/20" : "bg-gray-100"}`}>{leads.length}</span></button>
            </div>

            {message && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{message}</div>}

            {tab === "odp" ? (
                <IndihomeOdpPanel />
            ) : tab === "products" ? (
                <section className="space-y-5">
                    <div className="flex items-center justify-between">
                        <div><h3 className="font-bold text-gray-950">Katalog landing page</h3><p className="text-sm text-muted-foreground">Hanya paket aktif yang ditampilkan kepada pengunjung.</p></div>
                        <Button type="button" onClick={openAddProduct} className="rounded-lg bg-red-600 hover:bg-red-700"><Plus className="mr-2 h-4 w-4" /> Tambah paket</Button>
                    </div>
                    {products.length === 0 ? (
                        <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">Belum ada paket IndiHome. Tambahkan paket pertama untuk mulai.</CardContent></Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {products.map((product) => (
                                <Card key={product.id} className={!product.isActive ? "opacity-60" : ""}>
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-950 text-white"><Wifi className="h-5 w-5" /></div>
                                            <div className="flex gap-1"><button type="button" onClick={() => openEditProduct(product)} title="Edit paket" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => deleteProduct(product)} title="Hapus paket" className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className={`rounded-full px-2 py-1 ${product.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{product.isActive ? "Aktif" : "Nonaktif"}</span>{product.isFeatured && <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">Terpopuler</span>}</div>
                                        <h4 className="mt-4 font-bold text-gray-950">{product.name}</h4>
                                        <p className="mt-1 text-2xl font-black text-gray-950">{product.speedMbps} <span className="text-sm">Mbps</span></p>
                                        <p className="mt-2 font-semibold text-red-600">{rupiah.format(Number(product.monthlyPrice))}/bulan</p>
                                        <div className="mt-4 flex flex-wrap gap-1.5">{product.locations.map((location) => <span key={location} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{location}</span>)}</div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
            ) : tab === "settings" ? (
                <IndihomeLocationsBanner />
            ) : (
                <section className="space-y-4">
                    <form onSubmit={(event) => { event.preventDefault(); loadLeads().catch((error) => setMessage(error.message)); }} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-[1fr_220px_220px_auto]">
                        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Cari nama, WhatsApp, kecamatan" /></div>
                        <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="">Semua lokasi</option>{locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}</select>
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"><option value="">Semua status</option>{INDIHOME_LEAD_STATUSES.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>
                        <Button type="submit" variant="outline" className="rounded-lg"><Search className="mr-2 h-4 w-4" /> Terapkan</Button>
                    </form>
                    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Pelanggan</TableHead><TableHead>Paket</TableHead><TableHead>Lokasi</TableHead><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead className="w-16"><span className="sr-only">Detail</span></TableHead></TableRow></TableHeader><TableBody>
                        {leads.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Belum ada pengajuan sesuai filter.</TableCell></TableRow> : leads.map((lead) => (
                            <TableRow key={lead.id}>
                                <TableCell><p className="font-semibold text-gray-950">{lead.fullName}</p><p className="mt-1 text-xs text-muted-foreground">{lead.phoneE164}</p></TableCell>
                                <TableCell className="font-medium">{lead.packageName}</TableCell>
                                <TableCell><p>{lead.location}</p><p className="mt-1 text-xs text-muted-foreground">{lead.district}</p></TableCell>
                                <TableCell className="whitespace-nowrap text-xs">{new Date(lead.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                                <TableCell><select value={lead.status} onChange={(event) => updateLeadStatus(lead, event.target.value as IndihomeLeadStatus)} className="h-9 min-w-36 rounded-lg border border-gray-300 bg-white px-2 text-xs font-semibold">{INDIHOME_LEAD_STATUSES.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></TableCell>
                                <TableCell><button type="button" onClick={() => setSelectedLead(lead)} title="Lihat detail" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"><Eye className="h-4 w-4" /></button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody></Table></CardContent></Card>
                </section>
            )}

            <Dialog open={productDialog} onOpenChange={setProductDialog}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader><DialogTitle>{draft.id ? "Edit paket IndiHome" : "Tambah paket IndiHome"}</DialogTitle></DialogHeader>
                    <form onSubmit={saveProduct} className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2"><Label htmlFor="product-name">Nama paket</Label><Input id="product-name" required minLength={3} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
                            <div className="space-y-2"><Label htmlFor="speed">Kecepatan (Mbps)</Label><Input id="speed" type="number" min={10} required value={draft.speedMbps} onChange={(event) => setDraft({ ...draft, speedMbps: Number(event.target.value) })} /></div>
                            <div className="space-y-2"><Label htmlFor="price">Harga per bulan</Label><Input id="price" type="number" min={0} required value={draft.monthlyPrice} onChange={(event) => setDraft({ ...draft, monthlyPrice: event.target.value })} /></div>
                            <div className="space-y-2 sm:col-span-2"><Label htmlFor="description">Deskripsi</Label><Textarea id="description" required minLength={10} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
                            <div className="space-y-2 sm:col-span-2"><Label htmlFor="features">Fitur paket <span className="font-normal text-muted-foreground">(satu per baris)</span></Label><Textarea id="features" required rows={4} value={draft.featuresText} onChange={(event) => setDraft({ ...draft, featuresText: event.target.value })} /></div>
                        </div>
                        <fieldset><legend className="text-sm font-medium">Lokasi tersedia</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{locationOptions.map((location) => <label key={location} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm"><input type="checkbox" checked={draft.locations.includes(location)} onChange={() => toggleLocation(location)} className="h-4 w-4 accent-red-600" /> {location}</label>)}</div></fieldset>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2"><Label htmlFor="sort">Urutan</Label><Input id="sort" type="number" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></div>
                            <label className="flex items-center gap-2 pt-7 text-sm font-medium"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => setDraft({ ...draft, isFeatured: event.target.checked })} className="h-4 w-4 accent-red-600" /> Tandai terpopuler</label>
                            <label className="flex items-center gap-2 pt-7 text-sm font-medium"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="h-4 w-4 accent-red-600" /> Tampilkan paket</label>
                        </div>
                        {message && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
                        <DialogFooter><Button type="button" variant="outline" onClick={() => setProductDialog(false)}>Batal</Button><Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Simpan paket</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(selectedLead)} onOpenChange={(open) => !open && setSelectedLead(null)}>
                <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Detail pengajuan IndiHome</DialogTitle></DialogHeader>{selectedLead && <div className="space-y-5 text-sm">
                    <div className="grid gap-4 sm:grid-cols-2"><Detail label="Nama" value={selectedLead.fullName} /><Detail label="WhatsApp" value={selectedLead.phoneE164} /><Detail label="Email" value={selectedLead.email || "-"} /><Detail label="Paket" value={selectedLead.packageName} /><Detail label="Kabupaten / Kota" value={selectedLead.location} /><Detail label="Kecamatan" value={selectedLead.district} /></div>
                    <Detail label="Alamat pemasangan" value={selectedLead.address} />
                    <div className="space-y-2"><Label>Status tindak lanjut</Label><select value={selectedLead.status} onChange={(event) => updateLeadStatus(selectedLead, event.target.value as IndihomeLeadStatus)} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm">{INDIHOME_LEAD_STATUSES.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div>
                    <a href={`https://wa.me/${selectedLead.phoneE164.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700">Hubungi via WhatsApp</a>
                </div>}</DialogContent>
            </Dialog>
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return <div><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap font-medium text-gray-900">{value}</p></div>;
}
