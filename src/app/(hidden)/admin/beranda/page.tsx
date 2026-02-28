"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    Plus, Pencil, Trash2, Loader2, Save, GripVertical, ArrowUp, ArrowDown, Eye, EyeOff,
    Upload, LayoutGrid, Building2,
} from "lucide-react";
import Image from "next/image";

interface HeroSlide {
    id: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    imageUrl: string;
    bgColor: string;
    sortOrder: number;
    isActive: boolean;
}

interface QuickCard {
    label: string;
    icon: string;
    link: string;
    color: string;
}

interface OfficeData {
    city: string;
    label: string;
    image: string;
    address: string;
    phone: string;
    mapUrl: string;
}

const defaultSlide: Partial<HeroSlide> = {
    title: "", subtitle: "", ctaText: "", ctaLink: "",
    imageUrl: "", bgColor: "from-red-600 via-red-500 to-red-700", isActive: true,
};

const defaultQuickCards: QuickCard[] = [
    { label: "Hot Promo", icon: "⚡", link: "/program", color: "from-red-500 to-red-600" },
    { label: "Undian Berhadiah", icon: "🎁", link: "/program", color: "from-orange-500 to-red-500" },
    { label: "Paket Hemat", icon: "🛡️", link: "/program", color: "from-red-600 to-red-700" },
    { label: "Mitra Outlet", icon: "👥", link: "/program", color: "from-red-500 to-orange-500" },
];

const defaultOffices: OfficeData[] = [
    {
        city: "CIREBON", label: "Kantor Pusat Cirebon", image: "/images/office-cirebon.png",
        address: "Jl. Pemuda Raya No.21B, Sunyaragi, Kec. Kesambi, Kota Cirebon, Jawa Barat 45132",
        phone: "+62 851-6882-2280", mapUrl: "https://www.google.com/maps/search/Jl.+Pemuda+Raya+No.21B+Sunyaragi+Kesambi+Kota+Cirebon",
    },
    {
        city: "KUNINGAN", label: "Kantor Cabang Kuningan", image: "/images/office-kuningan.png",
        address: "Jl. Siliwangi No.45, Purwawinangun, Kec. Kuningan, Kabupaten Kuningan, Jawa Barat 45512",
        phone: "+62 851-6882-2280", mapUrl: "https://www.google.com/maps/search/Jl.+Siliwangi+No.45+Purwawinangun+Kuningan",
    },
];

export default function BerandaPage() {
    const [slides, setSlides] = useState<HeroSlide[]>([]);
    const [aboutContent, setAboutContent] = useState("");
    const [quickCards, setQuickCards] = useState<QuickCard[]>(defaultQuickCards);
    const [offices, setOffices] = useState<OfficeData[]>(defaultOffices);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editSlide, setEditSlide] = useState<Partial<HeroSlide>>(defaultSlide);
    const [isEditing, setIsEditing] = useState(false);
    const [message, setMessage] = useState("");
    const [isUploadingSlide, setIsUploadingSlide] = useState(false);

    // Quick card edit
    const [cardDialogOpen, setCardDialogOpen] = useState(false);
    const [editCardIndex, setEditCardIndex] = useState(-1);
    const [editCard, setEditCard] = useState<QuickCard>({ label: "", icon: "", link: "", color: "" });

    // Office edit
    const [officeDialogOpen, setOfficeDialogOpen] = useState(false);
    const [editOfficeIndex, setEditOfficeIndex] = useState(-1);
    const [editOffice, setEditOffice] = useState<OfficeData>({ city: "", label: "", image: "", address: "", phone: "", mapUrl: "" });

    useEffect(() => {
        Promise.all([
            fetch("/api/admin/hero-slides").then((r) => r.json()),
            fetch("/api/admin/settings").then((r) => r.json()),
        ]).then(([slidesData, settingsData]) => {
            setSlides(slidesData);
            setAboutContent(settingsData.about_content || "");
            if (settingsData.quick_access_cards) {
                try { setQuickCards(JSON.parse(settingsData.quick_access_cards)); } catch { /* use default */ }
            }
            if (settingsData.office_data) {
                try { setOffices(JSON.parse(settingsData.office_data)); } catch { /* use default */ }
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    // ---- Hero Slide handlers ----
    const openAdd = () => { setEditSlide({ ...defaultSlide }); setIsEditing(false); setDialogOpen(true); };
    const openEdit = (slide: HeroSlide) => { setEditSlide({ ...slide }); setIsEditing(true); setDialogOpen(true); };

    const handleSaveSlide = async () => {
        setSaving(true);
        try {
            if (isEditing && editSlide.id) {
                const res = await fetch(`/api/admin/hero-slides/${editSlide.id}`, {
                    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editSlide),
                });
                const updated = await res.json();
                setSlides((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            } else {
                const res = await fetch("/api/admin/hero-slides", {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editSlide),
                });
                const created = await res.json();
                setSlides((prev) => [...prev, created]);
            }
            setDialogOpen(false);
        } catch { /* ignore */ }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus banner ini?")) return;
        await fetch(`/api/admin/hero-slides/${id}`, { method: "DELETE" });
        setSlides((prev) => prev.filter((s) => s.id !== id));
    };

    const moveSlide = async (index: number, direction: "up" | "down") => {
        const newSlides = [...slides];
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= newSlides.length) return;
        [newSlides[index], newSlides[target]] = [newSlides[target], newSlides[index]];
        const order = newSlides.map((s, i) => ({ id: s.id, sortOrder: i }));
        setSlides(newSlides);
        await fetch("/api/admin/hero-slides/reorder", {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }),
        });
    };

    // ---- Settings save helper ----
    const saveSettings = async (key: string, value: string) => {
        setSaving(true);
        await fetch("/api/admin/settings", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings: [{ key, value, type: "text" }] }),
        });
        setMessage("Berhasil disimpan!");
        setSaving(false);
        setTimeout(() => setMessage(""), 3000);
    };

    const handleSaveAbout = () => saveSettings("about_content", aboutContent);
    const handleSaveCards = () => saveSettings("quick_access_cards", JSON.stringify(quickCards));
    const handleSaveOffices = () => saveSettings("office_data", JSON.stringify(offices));

    // ---- Quick Card handlers ----
    const openEditCard = (index: number) => {
        setEditCardIndex(index);
        setEditCard({ ...quickCards[index] });
        setCardDialogOpen(true);
    };

    const saveCard = () => {
        const updated = [...quickCards];
        updated[editCardIndex] = editCard;
        setQuickCards(updated);
        setCardDialogOpen(false);
    };

    // ---- Office handlers ----
    const openEditOffice = (index: number) => {
        setEditOfficeIndex(index);
        setEditOffice({ ...offices[index] });
        setOfficeDialogOpen(true);
    };

    const saveOffice = () => {
        const updated = [...offices];
        updated[editOfficeIndex] = editOffice;
        setOffices(updated);
        setOfficeDialogOpen(false);
    };

    const handleUploadOfficePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.url) setEditOffice({ ...editOffice, image: data.url });
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="max-w-5xl space-y-6">
            <h2 className="text-2xl font-bold">Kelola Beranda</h2>

            {message && <div className="p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{message}</div>}

            {/* Hero Slides */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">Banner Hero</CardTitle>
                    <Button size="sm" onClick={openAdd} className="cursor-pointer"><Plus className="mr-1 h-4 w-4" /> Tambah Banner</Button>
                </CardHeader>
                <CardContent>
                    {slides.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Belum ada banner</p>
                    ) : (
                        <div className="space-y-3">
                            {slides.map((slide, index) => (
                                <div key={slide.id} className="flex items-center gap-3 p-3 rounded-lg border bg-white">
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => moveSlide(index, "up")} disabled={index === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30 cursor-pointer"><ArrowUp className="h-3 w-3" /></button>
                                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                                        <button onClick={() => moveSlide(index, "down")} disabled={index === slides.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30 cursor-pointer"><ArrowDown className="h-3 w-3" /></button>
                                    </div>
                                    {slide.imageUrl ? (
                                        <div className="relative w-20 h-12 rounded-lg overflow-hidden shrink-0">
                                            <Image src={slide.imageUrl} alt="" fill className="object-cover" unoptimized={true} />
                                        </div>
                                    ) : (
                                        <div className={`w-20 h-12 rounded-lg bg-gradient-to-r ${slide.bgColor} shrink-0`} />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{slide.title || "(Tanpa judul)"}</p>
                                        <p className="text-xs text-muted-foreground truncate">{slide.subtitle}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => { const updated = { ...slide, isActive: !slide.isActive }; fetch(`/api/admin/hero-slides/${slide.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) }); setSlides(prev => prev.map(s => s.id === slide.id ? { ...s, isActive: !s.isActive } : s)); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
                                            {slide.isActive ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4" />}
                                        </button>
                                        <button onClick={() => openEdit(slide)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"><Pencil className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete(slide.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Access Cards */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2"><LayoutGrid className="h-5 w-5" /> Quick Access Cards</CardTitle>
                    <Button size="sm" onClick={handleSaveCards} disabled={saving} className="cursor-pointer">
                        <Save className="mr-1 h-4 w-4" /> Simpan
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {quickCards.map((card, i) => (
                            <div key={i} onClick={() => openEditCard(i)} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-white hover:border-red-200 hover:bg-red-50/30 transition-colors cursor-pointer group">
                                <div className={`w-12 h-12 relative rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-sm overflow-hidden`}>
                                    {card.icon.startsWith("/") || card.icon.startsWith("http") ? (
                                        <Image src={card.icon} alt="" fill className="object-contain p-2" unoptimized={true} />
                                    ) : (
                                        <span className="text-xl">{card.icon}</span>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-center">{card.label}</span>
                                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">Klik card untuk mengedit. Tekan Simpan setelah selesai mengubah.</p>
                </CardContent>
            </Card>

            {/* Office Photos */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5" /> Foto Kantor</CardTitle>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setOffices(prev => [...prev, { city: "", label: "Kantor Baru", image: "", address: "", phone: "", mapUrl: "" }]); }} className="cursor-pointer">
                            <Plus className="mr-1 h-4 w-4" /> Tambah
                        </Button>
                        <Button size="sm" onClick={handleSaveOffices} disabled={saving} className="cursor-pointer">
                            <Save className="mr-1 h-4 w-4" /> Simpan
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {offices.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Belum ada kantor. Tambahkan dari Pengaturan Website atau klik Tambah di atas.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {offices.map((office, i) => (
                                <div key={i} className="rounded-xl border overflow-hidden bg-white hover:border-red-200 transition-colors group relative">
                                    <div className="relative h-36 overflow-hidden cursor-pointer" onClick={() => openEditOffice(i)}>
                                        {office.image ? (
                                            <Image src={office.image} alt={office.label} fill className="object-cover" unoptimized={true} />
                                        ) : (
                                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-muted-foreground">
                                                <Upload className="h-8 w-8 opacity-30" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                            <Pencil className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                    <div className="p-3 flex items-center justify-between">
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEditOffice(i)}>
                                            <p className="font-bold text-sm">{office.label || "Kantor Baru"}</p>
                                            <p className="text-xs text-muted-foreground truncate">{office.address || "Belum ada alamat"}</p>
                                        </div>
                                        <button onClick={() => { if (confirm(`Hapus "${office.label || 'kantor ini'}"?`)) setOffices(prev => prev.filter((_, j) => j !== i)); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer shrink-0">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">Alamat kantor juga bisa dikelola di halaman Pengaturan Website. Klik foto untuk upload/ganti. Tekan Simpan setelah selesai.</p>
                </CardContent>
            </Card>

            {/* About Section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Tentang Perusahaan</CardTitle>
                    <Button size="sm" onClick={handleSaveAbout} disabled={saving} className="cursor-pointer">
                        <Save className="mr-1 h-4 w-4" /> Simpan
                    </Button>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={aboutContent}
                        onChange={(e) => setAboutContent(e.target.value)}
                        rows={6}
                        placeholder="Tulis deskripsi tentang perusahaan..."
                        className="min-h-[150px]"
                    />
                    <p className="text-xs text-muted-foreground mt-2">Mendukung HTML sederhana: &lt;p&gt;, &lt;b&gt;, &lt;i&gt;, &lt;ul&gt;, &lt;li&gt;</p>
                </CardContent>
            </Card>

            {/* Slide Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Banner" : "Tambah Banner"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Judul</Label>
                            <Input value={editSlide.title || ""} onChange={(e) => setEditSlide({ ...editSlide, title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Subtitle</Label>
                            <Input value={editSlide.subtitle || ""} onChange={(e) => setEditSlide({ ...editSlide, subtitle: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Teks Tombol CTA</Label>
                                <Input value={editSlide.ctaText || ""} onChange={(e) => setEditSlide({ ...editSlide, ctaText: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Link CTA</Label>
                                <Input value={editSlide.ctaLink || ""} onChange={(e) => setEditSlide({ ...editSlide, ctaLink: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Gambar Background (opsional)</Label>
                            <div className="flex items-center gap-3">
                                <label className="flex-1 flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground w-full">
                                    {isUploadingSlide ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : (
                                        <Upload className="h-4 w-4" />
                                    )}
                                    <span>{isUploadingSlide ? "Mengupload..." : editSlide.imageUrl ? "Ganti gambar" : "Upload gambar"}</span>
                                    <input type="file" accept="image/*" className="hidden" disabled={isUploadingSlide} onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setIsUploadingSlide(true);
                                        try {
                                            const fd = new FormData();
                                            fd.append("file", file);
                                            const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                                            const data = await res.json();
                                            if (res.ok && data.url) {
                                                setEditSlide({ ...editSlide, imageUrl: data.url });
                                            } else {
                                                alert(data.error || "Gagal upload gambar");
                                            }
                                        } catch {
                                            alert("Gagal koneksi server saat upload file.");
                                        } finally {
                                            setIsUploadingSlide(false);
                                            e.target.value = "";
                                        }
                                    }} />
                                </label>
                                {editSlide.imageUrl && (
                                    <button onClick={() => setEditSlide({ ...editSlide, imageUrl: "" })} className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                                )}
                            </div>
                            {editSlide.imageUrl && (
                                <div className="relative w-full h-32 rounded-lg border overflow-hidden">
                                    <Image src={editSlide.imageUrl} alt="Preview" fill className="object-cover" unoptimized={true} />
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">Jika gambar diupload, digunakan sebagai background. Jika tidak, warna gradient dipakai.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Gradient Warna Background</Label>
                            <Input value={editSlide.bgColor || ""} onChange={(e) => setEditSlide({ ...editSlide, bgColor: e.target.value })} placeholder="from-red-600 via-red-500 to-red-700" />
                            <div className={`h-8 rounded-lg bg-gradient-to-r ${editSlide.bgColor || "from-red-600 via-red-500 to-red-700"}`} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Batal</Button>
                        <Button onClick={handleSaveSlide} disabled={saving} className="cursor-pointer">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quick Card Edit Dialog */}
            <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Edit Quick Access Card</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nama Card</Label>
                            <Input value={editCard.label} onChange={(e) => setEditCard({ ...editCard, label: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Icon (Emoji atau URL gambar)</Label>
                            <div className="flex gap-2">
                                <Input value={editCard.icon} onChange={(e) => setEditCard({ ...editCard, icon: e.target.value })} placeholder="⚡ atau /images/icon.png" className="flex-1" />
                                <label className="px-3 py-2 border rounded-md cursor-pointer hover:bg-muted text-sm flex items-center gap-1 shrink-0">
                                    <Upload className="h-3 w-3" />
                                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const fd = new FormData();
                                        fd.append("file", file);
                                        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                                        const data = await res.json();
                                        if (data.url) setEditCard({ ...editCard, icon: data.url });
                                    }} />
                                </label>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${editCard.color} flex items-center justify-center overflow-hidden`}>
                                    {editCard.icon.startsWith("/") || editCard.icon.startsWith("http") ? (
                                        <Image src={editCard.icon} alt="" fill className="object-contain p-2" unoptimized={true} />
                                    ) : (
                                        <span className="text-xl">{editCard.icon}</span>
                                    )}
                                </div>
                                <span className="text-sm font-bold">{editCard.label}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Link / Hyperlink</Label>
                            <Input value={editCard.link} onChange={(e) => setEditCard({ ...editCard, link: e.target.value })} placeholder="/program" />
                        </div>
                        <div className="space-y-2">
                            <Label>Gradient Warna</Label>
                            <Input value={editCard.color} onChange={(e) => setEditCard({ ...editCard, color: e.target.value })} placeholder="from-red-500 to-red-600" />
                            <div className={`h-8 rounded-lg bg-gradient-to-br ${editCard.color || "from-red-500 to-red-600"}`} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCardDialogOpen(false)} className="cursor-pointer">Batal</Button>
                        <Button onClick={saveCard} className="cursor-pointer">Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Office Edit Dialog */}
            <Dialog open={officeDialogOpen} onOpenChange={setOfficeDialogOpen}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Edit Kantor</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Kode Kota</Label>
                                <Input value={editOffice.city} onChange={(e) => setEditOffice({ ...editOffice, city: e.target.value })} placeholder="CIREBON" />
                            </div>
                            <div className="space-y-2">
                                <Label>Label</Label>
                                <Input value={editOffice.label} onChange={(e) => setEditOffice({ ...editOffice, label: e.target.value })} placeholder="Kantor Pusat Cirebon" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Foto Kantor</Label>
                            <div className="flex items-center gap-3">
                                <label className="flex-1 flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                                    <Upload className="h-4 w-4" />
                                    <span>{editOffice.image ? "Ganti foto" : "Upload foto"}</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadOfficePhoto} />
                                </label>
                                {editOffice.image && (
                                    <button onClick={() => setEditOffice({ ...editOffice, image: "" })} className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                                )}
                            </div>
                            {editOffice.image && (
                                <div className="relative w-full h-32 rounded-lg border overflow-hidden">
                                    <Image src={editOffice.image} alt="Preview" fill className="object-cover" unoptimized={true} />
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Alamat Lengkap</Label>
                            <Textarea value={editOffice.address} onChange={(e) => setEditOffice({ ...editOffice, address: e.target.value })} rows={2} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Telepon</Label>
                                <Input value={editOffice.phone} onChange={(e) => setEditOffice({ ...editOffice, phone: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Link Google Maps</Label>
                                <Input value={editOffice.mapUrl} onChange={(e) => setEditOffice({ ...editOffice, mapUrl: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOfficeDialogOpen(false)} className="cursor-pointer">Batal</Button>
                        <Button onClick={saveOffice} className="cursor-pointer">Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
