"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, ImageIcon, Upload, Eye, EyeOff, ArrowUp, ArrowDown, LayoutGrid, Image as ImageLucide } from "lucide-react";
import Image from "next/image";

// ── Types ───────────────────────────────────────────────────────────
interface ShopBanner {
    id: string; title: string; imageUrl: string; link: string;
    sortOrder: number; isActive: boolean;
}

interface ShopSection {
    id: string; type: "banner" | "product_carousel" | "service_grid" | "cta_cards";
    title: string; subtitle: string; config: string;
    sortOrder: number; isActive: boolean;
}

interface ServiceItem { icon: string; label: string; link: string; }
interface CTAItem { icon: string; label: string; subtitle: string; link: string; }

const emptyBanner: Partial<ShopBanner> = { title: "", imageUrl: "", link: "", isActive: true };
const emptySection: Partial<ShopSection> = { type: "product_carousel", title: "", subtitle: "", config: "{}", isActive: true };

const sectionTypeLabels: Record<string, string> = {
    product_carousel: "Produk Carousel",
    service_grid: "Service Grid",
    cta_cards: "CTA Cards",
};

const sectionTypeIcons: Record<string, string> = {
    product_carousel: "🛒",
    service_grid: "⚡",
    cta_cards: "📋",
};

// ── Main Page ───────────────────────────────────────────────────────
export default function AdminShopPage() {
    const [tab, setTab] = useState<"banners" | "sections">("banners");
    const [banners, setBanners] = useState<ShopBanner[]>([]);
    const [sections, setSections] = useState<ShopSection[]>([]);
    const [loading, setLoading] = useState(true);

    // Banner dialog
    const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
    const [editBanner, setEditBanner] = useState<Partial<ShopBanner>>(emptyBanner);
    const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
    const [bannerUploading, setBannerUploading] = useState(false);

    // Section dialog
    const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
    const [editSection, setEditSection] = useState<Partial<ShopSection>>(emptySection);
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

    // Section config state
    const [configFilterType, setConfigFilterType] = useState("all");
    const [configItems, setConfigItems] = useState<(ServiceItem | CTAItem)[]>([]);

    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [bRes, sRes] = await Promise.all([
                fetch("/api/admin/shop/banners").then(r => r.json()),
                fetch("/api/admin/shop/sections").then(r => r.json()),
            ]);
            setBanners(bRes || []);
            setSections(sRes || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── Banner CRUD ─────────────────────────────────────────────────
    const openBannerDialog = (banner?: ShopBanner) => {
        if (banner) {
            setEditBanner(banner);
            setEditingBannerId(banner.id);
        } else {
            setEditBanner({ ...emptyBanner });
            setEditingBannerId(null);
        }
        setBannerDialogOpen(true);
    };

    const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBannerUploading(true);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (data.url) setEditBanner(p => ({ ...p, imageUrl: data.url }));
        } catch { /* ignore */ }
        setBannerUploading(false);
    };

    const saveBanner = async () => {
        setSaving(true);
        try {
            if (editingBannerId) {
                await fetch(`/api/admin/shop/banners/${editingBannerId}`, {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editBanner),
                });
            } else {
                await fetch("/api/admin/shop/banners", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editBanner),
                });
            }
            setBannerDialogOpen(false);
            load();
        } catch { /* ignore */ }
        setSaving(false);
    };

    const deleteBanner = async (id: string) => {
        if (!confirm("Hapus banner ini?")) return;
        await fetch(`/api/admin/shop/banners/${id}`, { method: "DELETE" });
        load();
    };

    const toggleBanner = async (banner: ShopBanner) => {
        await fetch(`/api/admin/shop/banners/${banner.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...banner, isActive: !banner.isActive }),
        });
        load();
    };

    // ── Section CRUD ────────────────────────────────────────────────
    const openSectionDialog = (section?: ShopSection) => {
        if (section) {
            setEditSection(section);
            setEditingSectionId(section.id);
            try {
                const cfg = JSON.parse(section.config);
                setConfigFilterType(cfg.filterType || "all");
                setConfigItems(cfg.items || []);
            } catch {
                setConfigFilterType("all");
                setConfigItems([]);
            }
        } else {
            setEditSection({ ...emptySection });
            setEditingSectionId(null);
            setConfigFilterType("all");
            setConfigItems([]);
        }
        setSectionDialogOpen(true);
    };

    const buildSectionConfig = (): string => {
        const sType = editSection.type;
        if (sType === "product_carousel") return JSON.stringify({ filterType: configFilterType });
        if (sType === "service_grid" || sType === "cta_cards") return JSON.stringify({ items: configItems });
        return "{}";
    };

    const saveSection = async () => {
        setSaving(true);
        const payload = { ...editSection, config: buildSectionConfig() };
        try {
            if (editingSectionId) {
                await fetch(`/api/admin/shop/sections/${editingSectionId}`, {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else {
                await fetch("/api/admin/shop/sections", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }
            setSectionDialogOpen(false);
            load();
        } catch { /* ignore */ }
        setSaving(false);
    };

    const deleteSection = async (id: string) => {
        if (!confirm("Hapus section ini?")) return;
        await fetch(`/api/admin/shop/sections/${id}`, { method: "DELETE" });
        load();
    };

    const toggleSection = async (section: ShopSection) => {
        await fetch(`/api/admin/shop/sections/${section.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...section, isActive: !section.isActive }),
        });
        load();
    };

    const moveSectionOrder = async (section: ShopSection, dir: -1 | 1) => {
        await fetch(`/api/admin/shop/sections/${section.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...section, sortOrder: section.sortOrder + dir }),
        });
        load();
    };

    // ── Config Items Management ─────────────────────────────────────
    const addConfigItem = () => {
        if (editSection.type === "cta_cards") {
            setConfigItems([...configItems, { icon: "📋", label: "", subtitle: "", link: "" }]);
        } else {
            setConfigItems([...configItems, { icon: "⚡", label: "", link: "" }]);
        }
    };

    const updateConfigItem = (idx: number, field: string, value: string) => {
        setConfigItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const removeConfigItem = (idx: number) => {
        setConfigItems(items => items.filter((_, i) => i !== idx));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">🛍️ Kelola Halaman Shop</h1>
                <a href="/shop" target="_blank" className="text-sm text-red-600 hover:underline font-medium">Lihat Halaman →</a>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b pb-1">
                <button onClick={() => setTab("banners")} className={`px-5 py-2.5 rounded-t-lg text-sm font-semibold transition-colors cursor-pointer ${tab === "banners" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    <ImageLucide className="h-4 w-4 inline mr-1.5" /> Banner ({banners.length})
                </button>
                <button onClick={() => setTab("sections")} className={`px-5 py-2.5 rounded-t-lg text-sm font-semibold transition-colors cursor-pointer ${tab === "sections" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    <LayoutGrid className="h-4 w-4 inline mr-1.5" /> Sections ({sections.length})
                </button>
            </div>

            {/* ── Banner Tab ──────────────────────────────────────────── */}
            {tab === "banners" && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => openBannerDialog()} className="bg-red-600 hover:bg-red-700 cursor-pointer">
                            <Plus className="h-4 w-4 mr-1" /> Tambah Banner
                        </Button>
                    </div>

                    {banners.length === 0 ? (
                        <Card><CardContent className="py-12 text-center text-gray-400"><ImageIcon className="h-10 w-10 mx-auto mb-3" /><p>Belum ada banner. Tambahkan banner hero carousel.</p></CardContent></Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {banners.map(b => (
                                <Card key={b.id} className={`overflow-hidden ${!b.isActive ? "opacity-50" : ""}`}>
                                    <div className="relative h-40 bg-gray-100">
                                        {b.imageUrl ? (
                                            <Image src={b.imageUrl} alt={b.title} fill className="object-cover" unoptimized />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="h-12 w-12 text-gray-300" /></div>
                                        )}
                                        <div className="absolute top-2 right-2 flex gap-1">
                                            <button onClick={() => toggleBanner(b)} className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white cursor-pointer shadow" title={b.isActive ? "Nonaktifkan" : "Aktifkan"}>
                                                {b.isActive ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                                            </button>
                                        </div>
                                    </div>
                                    <CardContent className="p-3 flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-sm truncate">{b.title || "Tanpa Judul"}</p>
                                            <p className="text-xs text-gray-400 truncate">{b.link || "Tanpa Link"}</p>
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                            <button onClick={() => openBannerDialog(b)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 cursor-pointer"><Pencil className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => deleteBanner(b.id)} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 cursor-pointer"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Section Tab ─────────────────────────────────────────── */}
            {tab === "sections" && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => openSectionDialog()} className="bg-red-600 hover:bg-red-700 cursor-pointer">
                            <Plus className="h-4 w-4 mr-1" /> Tambah Section
                        </Button>
                    </div>

                    {sections.length === 0 ? (
                        <Card><CardContent className="py-12 text-center text-gray-400"><LayoutGrid className="h-10 w-10 mx-auto mb-3" /><p>Belum ada section. Tambahkan section untuk menampilkan konten.</p></CardContent></Card>
                    ) : (
                        <div className="space-y-3">
                            {sections.map(s => (
                                <Card key={s.id} className={`${!s.isActive ? "opacity-50" : ""}`}>
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">
                                            {sectionTypeIcons[s.type] || "📦"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm">{s.title || "Tanpa Judul"}</p>
                                            <p className="text-xs text-gray-400">{sectionTypeLabels[s.type] || s.type} • Order: {s.sortOrder}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => moveSectionOrder(s, -1)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => moveSectionOrder(s, 1)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => toggleSection(s)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 cursor-pointer">
                                                {s.isActive ? <Eye className="h-3.5 w-3.5 text-green-600" /> : <EyeOff className="h-3.5 w-3.5 text-gray-400" />}
                                            </button>
                                            <button onClick={() => openSectionDialog(s)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 cursor-pointer"><Pencil className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => deleteSection(s.id)} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 cursor-pointer"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Banner Dialog ───────────────────────────────────────── */}
            <Dialog open={bannerDialogOpen} onOpenChange={setBannerDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingBannerId ? "Edit Banner" : "Tambah Banner"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Judul (Opsional)</Label>
                            <Input value={editBanner.title || ""} onChange={e => setEditBanner({ ...editBanner, title: e.target.value })} placeholder="Promo Spesial..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Gambar Banner</Label>
                            {editBanner.imageUrl && (
                                <div className="relative h-40 rounded-lg overflow-hidden bg-gray-100 mb-2">
                                    <Image src={editBanner.imageUrl} alt="Preview" fill className="object-cover" unoptimized />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <label className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors text-sm font-medium text-gray-600">
                                    {bannerUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    Upload Gambar
                                    <input type="file" accept="image/*" className="hidden" onChange={handleBannerImageUpload} />
                                </label>
                                <Input value={editBanner.imageUrl || ""} onChange={e => setEditBanner({ ...editBanner, imageUrl: e.target.value })} placeholder="atau paste URL..." className="flex-1" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Link (Opsional)</Label>
                            <Input value={editBanner.link || ""} onChange={e => setEditBanner({ ...editBanner, link: e.target.value })} placeholder="https://..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBannerDialogOpen(false)} className="cursor-pointer">Batal</Button>
                        <Button onClick={saveBanner} disabled={saving} className="bg-red-600 hover:bg-red-700 cursor-pointer">
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Section Dialog ──────────────────────────────────────── */}
            <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingSectionId ? "Edit Section" : "Tambah Section"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipe Section</Label>
                                <select
                                    value={editSection.type || "product_carousel"}
                                    onChange={e => {
                                        setEditSection({ ...editSection, type: e.target.value as ShopSection["type"] });
                                        setConfigItems([]);
                                    }}
                                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                                >
                                    <option value="product_carousel">🛒 Produk Carousel</option>
                                    <option value="service_grid">⚡ Service Grid</option>
                                    <option value="cta_cards">📋 CTA Cards</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Judul Section</Label>
                                <Input value={editSection.title || ""} onChange={e => setEditSection({ ...editSection, title: e.target.value })} placeholder="Voucher Games Murah" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Subtitle (Opsional)</Label>
                            <Input value={editSection.subtitle || ""} onChange={e => setEditSection({ ...editSection, subtitle: e.target.value })} placeholder="Dapatkan voucher game favorit..." />
                        </div>

                        {/* Product Carousel Config */}
                        {editSection.type === "product_carousel" && (
                            <Card>
                                <CardHeader className="p-4"><CardTitle className="text-sm">Konfigurasi Carousel</CardTitle></CardHeader>
                                <CardContent className="p-4 pt-0 space-y-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Filter Tipe Produk</Label>
                                        <select value={configFilterType} onChange={e => setConfigFilterType(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm bg-white">
                                            <option value="all">Semua Produk</option>
                                            <option value="fisik">Produk Fisik</option>
                                            <option value="virtual">Voucher Internet</option>
                                            <option value="jasa">Jasa</option>
                                        </select>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Service Grid Config */}
                        {editSection.type === "service_grid" && (
                            <Card>
                                <CardHeader className="p-4 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm">Item Layanan</CardTitle>
                                    <Button size="sm" variant="outline" onClick={addConfigItem} className="cursor-pointer"><Plus className="h-3 w-3 mr-1" /> Tambah</Button>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 space-y-3">
                                    {configItems.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                            <Input value={item.icon} onChange={e => updateConfigItem(idx, "icon", e.target.value)} className="w-14 text-center" placeholder="⚡" />
                                            <Input value={item.label} onChange={e => updateConfigItem(idx, "label", e.target.value)} className="flex-1" placeholder="Label" />
                                            <Input value={item.link} onChange={e => updateConfigItem(idx, "link", e.target.value)} className="flex-1" placeholder="Link URL" />
                                            <button onClick={() => removeConfigItem(idx)} className="w-8 h-8 shrink-0 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 cursor-pointer"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                                        </div>
                                    ))}
                                    {configItems.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Belum ada item</p>}
                                </CardContent>
                            </Card>
                        )}

                        {/* CTA Cards Config */}
                        {editSection.type === "cta_cards" && (
                            <Card>
                                <CardHeader className="p-4 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm">CTA Items</CardTitle>
                                    <Button size="sm" variant="outline" onClick={addConfigItem} className="cursor-pointer"><Plus className="h-3 w-3 mr-1" /> Tambah</Button>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 space-y-3">
                                    {configItems.map((item, idx) => (
                                        <div key={idx} className="p-3 bg-gray-50 rounded-lg space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Input value={item.icon} onChange={e => updateConfigItem(idx, "icon", e.target.value)} className="w-14 text-center" placeholder="📋" />
                                                <Input value={item.label} onChange={e => updateConfigItem(idx, "label", e.target.value)} className="flex-1" placeholder="Judul" />
                                                <button onClick={() => removeConfigItem(idx)} className="w-8 h-8 shrink-0 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 cursor-pointer"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                                            </div>
                                            <div className="flex gap-2 pl-16">
                                                <Input value={(item as CTAItem).subtitle || ""} onChange={e => updateConfigItem(idx, "subtitle", e.target.value)} className="flex-1" placeholder="Subtitle" />
                                                <Input value={item.link} onChange={e => updateConfigItem(idx, "link", e.target.value)} className="flex-1" placeholder="Link URL" />
                                            </div>
                                        </div>
                                    ))}
                                    {configItems.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Belum ada item</p>}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSectionDialogOpen(false)} className="cursor-pointer">Batal</Button>
                        <Button onClick={saveSection} disabled={saving} className="bg-red-600 hover:bg-red-700 cursor-pointer">
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
