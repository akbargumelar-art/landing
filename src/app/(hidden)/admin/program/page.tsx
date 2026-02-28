"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, Upload, ImageIcon } from "lucide-react";
import Image from "next/image";

interface Program {
    id: string;
    slug: string;
    title: string;
    description: string;
    thumbnail: string;
    category: string;
    period: string;
    content: string;
    terms: string;
    mechanics: string;
    gallery: string;
    prizes: string;
    status: string;
    sortOrder: number;
}

interface Prize {
    title: string;
    imageUrl: string;
}

const emptyProgram: Partial<Program> = {
    title: "", description: "", thumbnail: "", category: "pelanggan",
    period: "", content: "", terms: "[]", mechanics: "[]", gallery: "[]", prizes: "[]", status: "draft",
};

export default function ProgramPage() {
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editProgram, setEditProgram] = useState<Partial<Program>>(emptyProgram);
    const [isEditing, setIsEditing] = useState(false);
    const [termsText, setTermsText] = useState("");
    const [mechanicsText, setMechanicsText] = useState("");
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [prizesList, setPrizesList] = useState<Prize[]>([]);
    const [filterCategory, setFilterCategory] = useState("");

    useEffect(() => {
        fetch("/api/admin/programs")
            .then((r) => r.json())
            .then((data) => { setPrograms(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const openAdd = () => {
        setEditProgram({ ...emptyProgram });
        setTermsText("");
        setMechanicsText("");
        setGalleryImages([]);
        setPrizesList([]);
        setIsEditing(false);
        setDialogOpen(true);
    };

    const openEdit = (program: Program) => {
        setEditProgram({ ...program });
        try { setTermsText(JSON.parse(program.terms || "[]").join("\n")); } catch { setTermsText(""); }
        try { setMechanicsText(JSON.parse(program.mechanics || "[]").join("\n")); } catch { setMechanicsText(""); }
        try { setGalleryImages(JSON.parse(program.gallery || "[]")); } catch { setGalleryImages([]); }
        try { setPrizesList(JSON.parse(program.prizes || "[]")); } catch { setPrizesList([]); }
        setIsEditing(true);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        setSaving(true);
        const payload = {
            ...editProgram,
            terms: JSON.stringify(termsText.split("\n").filter((t) => t.trim())),
            mechanics: JSON.stringify(mechanicsText.split("\n").filter((t) => t.trim())),
            gallery: JSON.stringify(galleryImages),
            prizes: JSON.stringify(prizesList),
        };

        try {
            if (isEditing && editProgram.id) {
                const res = await fetch(`/api/admin/programs/${editProgram.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const updated = await res.json();
                setPrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            } else {
                const res = await fetch("/api/admin/programs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const created = await res.json();
                setPrograms((prev) => [...prev, created]);
            }
            setDialogOpen(false);
        } catch { /* ignore */ }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus program ini? Semua data terkait (form, peserta, pemenang) akan ikut terhapus.")) return;
        await fetch(`/api/admin/programs/${id}`, { method: "DELETE" });
        setPrograms((prev) => prev.filter((p) => p.id !== id));
    };

    const toggleStatus = async (program: Program) => {
        const newStatus = program.status === "published" ? "draft" : "published";
        await fetch(`/api/admin/programs/${program.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...program, status: newStatus }),
        });
        setPrograms((prev) => prev.map((p) => (p.id === program.id ? { ...p, status: newStatus } : p)));
    };

    const handleUploadThumbnail = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.url) setEditProgram({ ...editProgram, thumbnail: data.url });
    };

    const handleUploadGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        for (let i = 0; i < files.length; i++) {
            const fd = new FormData();
            fd.append("file", files[i]);
            const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (data.url) setGalleryImages((prev) => [...prev, data.url]);
        }
    };

    const handleUploadPrizeImage = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.url) {
            setPrizesList((prev) => prev.map((p, i) => i === index ? { ...p, imageUrl: data.url } : p));
        }
    };

    const filtered = filterCategory
        ? programs.filter((p) => p.category === filterCategory)
        : programs;

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Kelola Program</h2>
                <Button onClick={openAdd} className="cursor-pointer"><Plus className="mr-1 h-4 w-4" /> Tambah Program</Button>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2">
                <button onClick={() => setFilterCategory("")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${!filterCategory ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Semua</button>
                <button onClick={() => setFilterCategory("pelanggan")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${filterCategory === "pelanggan" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Program Pelanggan</button>
                <button onClick={() => setFilterCategory("mitra")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${filterCategory === "mitra" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Program Mitra Outlet</button>
            </div>

            {filtered.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Belum ada program</CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((program) => (
                        <Card key={program.id} className="overflow-hidden">
                            <CardContent className="p-4 flex items-center gap-4">
                                {/* Thumbnail */}
                                {program.thumbnail ? (
                                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                                        <Image src={program.thumbnail} alt="" fill className="object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 shrink-0 flex items-center justify-center">
                                        <span className="text-white font-bold text-lg">{program.title.charAt(0)}</span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-sm truncate">{program.title}</p>
                                        <Badge variant={program.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
                                            {program.status === "published" ? "Published" : "Draft"}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs shrink-0">
                                            {program.category === "mitra" ? "Mitra" : "Pelanggan"}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{program.period}</p>
                                    <p className="text-xs text-muted-foreground truncate">{program.description}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => toggleStatus(program)} className="p-2 rounded-lg hover:bg-muted cursor-pointer" title={program.status === "published" ? "Nonaktifkan" : "Publikasikan"}>
                                        {program.status === "published" ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    <button onClick={() => openEdit(program)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"><Pencil className="h-4 w-4" /></button>
                                    <button onClick={() => handleDelete(program.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Program Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Program" : "Tambah Program"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Judul Program</Label>
                                <Input value={editProgram.title || ""} onChange={(e) => setEditProgram({ ...editProgram, title: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Kategori</Label>
                                <select value={editProgram.category || "pelanggan"} onChange={(e) => setEditProgram({ ...editProgram, category: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm bg-white">
                                    <option value="pelanggan">Program Pelanggan</option>
                                    <option value="mitra">Program Mitra Outlet</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Deskripsi Singkat</Label>
                            <Textarea value={editProgram.description || ""} onChange={(e) => setEditProgram({ ...editProgram, description: e.target.value })} rows={2} />
                        </div>
                        <div className="space-y-2">
                            <Label>Periode Berlaku</Label>
                            <Input value={editProgram.period || ""} onChange={(e) => setEditProgram({ ...editProgram, period: e.target.value })} placeholder="1 Januari - 31 Maret 2026" />
                        </div>

                        {/* Thumbnail Upload */}
                        <div className="space-y-2">
                            <Label>Key Visual / Gambar Program</Label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                                    <Upload className="h-4 w-4" />
                                    <span>{editProgram.thumbnail ? "Ganti gambar" : "Upload gambar"}</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadThumbnail} />
                                </label>
                                {editProgram.thumbnail && (
                                    <button onClick={() => setEditProgram({ ...editProgram, thumbnail: "" })} className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                                )}
                            </div>
                            {editProgram.thumbnail ? (
                                <div className="relative w-full h-40 rounded-lg border overflow-hidden">
                                    <Image src={editProgram.thumbnail} alt="Thumbnail" fill className="object-cover" />
                                </div>
                            ) : (
                                <div className="w-full h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground">
                                    <ImageIcon className="h-8 w-8 opacity-30" />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Konten Detail (HTML)</Label>
                            <Textarea value={editProgram.content || ""} onChange={(e) => setEditProgram({ ...editProgram, content: e.target.value })} rows={4} />
                        </div>
                        <div className="space-y-2">
                            <Label>Syarat & Ketentuan (satu per baris)</Label>
                            <Textarea value={termsText} onChange={(e) => setTermsText(e.target.value)} rows={4} placeholder={"Syarat 1\nSyarat 2\nSyarat 3"} />
                        </div>
                        <div className="space-y-2">
                            <Label>Cara Mengikuti (satu per baris)</Label>
                            <Textarea value={mechanicsText} onChange={(e) => setMechanicsText(e.target.value)} rows={4} placeholder={"Langkah 1\nLangkah 2\nLangkah 3"} />
                        </div>

                        {/* Winner Gallery */}
                        <div className="space-y-2">
                            <Label>Galeri Pemenang / Dokumentasi Penyerahan Hadiah</Label>
                            <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                                <Upload className="h-4 w-4" />
                                <span>Upload foto (bisa pilih beberapa)</span>
                                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUploadGallery} />
                            </label>
                            {galleryImages.length > 0 && (
                                <div className="grid grid-cols-4 gap-2">
                                    {galleryImages.map((img, i) => (
                                        <div key={i} className="relative group w-full h-20 rounded-lg border overflow-hidden">
                                            <Image src={img} alt="" fill className="object-cover" />
                                            <button
                                                onClick={() => setGalleryImages(galleryImages.filter((_, j) => j !== i))}
                                                className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">Upload foto dokumentasi penyerahan hadiah untuk ditampilkan di halaman program.</p>
                        </div>

                        {/* Prizes / Hadiah */}
                        <div className="space-y-2">
                            <Label>Hadiah Program</Label>
                            {prizesList.map((prize, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 border rounded-lg bg-gray-50">
                                    {/* Prize Image */}
                                    <div className="shrink-0">
                                        {prize.imageUrl ? (
                                            <div className="relative w-20 h-20 rounded-lg border overflow-hidden group">
                                                <Image src={prize.imageUrl} alt="" fill className="object-cover" />
                                                <button
                                                    onClick={() => setPrizesList(prev => prev.map((p, j) => j === i ? { ...p, imageUrl: "" } : p))}
                                                    className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                >
                                                    <Trash2 className="h-2.5 w-2.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-20 h-20 rounded-lg border-2 border-dashed cursor-pointer hover:bg-white transition-colors">
                                                <ImageIcon className="h-5 w-5 text-muted-foreground opacity-40" />
                                                <span className="text-[9px] text-muted-foreground mt-0.5">Upload</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadPrizeImage(e, i)} />
                                            </label>
                                        )}
                                    </div>
                                    {/* Prize Title */}
                                    <div className="flex-1 space-y-1">
                                        <Input
                                            value={prize.title}
                                            onChange={(e) => setPrizesList(prev => prev.map((p, j) => j === i ? { ...p, title: e.target.value } : p))}
                                            placeholder="Nama hadiah (misal: Samsung Galaxy A16)"
                                            className="text-sm"
                                        />
                                    </div>
                                    {/* Remove */}
                                    <button onClick={() => setPrizesList(prev => prev.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600 cursor-pointer shrink-0 mt-1">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => setPrizesList(prev => [...prev, { title: "", imageUrl: "" }])} className="w-full cursor-pointer text-xs">
                                <Plus className="mr-1 h-3 w-3" /> Tambah Hadiah
                            </Button>
                            <p className="text-xs text-muted-foreground">Tambahkan hadiah beserta gambarnya untuk ditampilkan di halaman detail program.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Batal</Button>
                        <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
