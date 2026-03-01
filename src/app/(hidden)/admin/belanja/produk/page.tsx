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

interface Product {
    id: string;
    name: string;
    type: "fisik" | "virtual" | "jasa";
    description: string;
    imageUrl: string;
    price: string | number;
    stock: number;
    isActive: boolean;
}

const emptyProduct: Partial<Product> = {
    name: "", type: "fisik", description: "", imageUrl: "", price: "0", stock: 0, isActive: true,
};

export default function ProdukBelanjaPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editProduct, setEditProduct] = useState<Partial<Product>>(emptyProduct);
    const [isEditing, setIsEditing] = useState(false);
    const [filterType, setFilterType] = useState("");
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    useEffect(() => {
        fetch("/api/admin/products")
            .then((r) => r.json())
            .then((data) => { setProducts(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const openAdd = () => {
        setEditProduct({ ...emptyProduct });
        setIsEditing(false);
        setDialogOpen(true);
    };

    const openEdit = (product: Product) => {
        setEditProduct({ ...product });
        setIsEditing(true);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!editProduct.name) {
            alert("Nama produk wajib diisi!");
            return;
        }

        setSaving(true);
        const payload = {
            ...editProduct,
            price: editProduct.price?.toString() || "0",
            stock: Number(editProduct.stock) || 0,
        };

        try {
            if (isEditing && editProduct.id) {
                const res = await fetch(`/api/admin/products/${editProduct.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const updated = await res.json();
                setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            } else {
                const res = await fetch("/api/admin/products", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const created = await res.json();
                setProducts((prev) => [...prev, created]);
            }
            setDialogOpen(false);
        } catch {
            alert("Gagal menyimpan produk.");
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus produk ini? Transaksi dan logger terkait tidak akan dihapus demi audit database.")) return;
        await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
        setProducts((prev) => prev.filter((p) => p.id !== id));
    };

    const toggleStatus = async (product: Product) => {
        const newStatus = !product.isActive;
        await fetch(`/api/admin/products/${product.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...product, isActive: newStatus }),
        });
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, isActive: newStatus } : p)));
    };

    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingImage(true);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (res.ok && data.url) {
                setEditProduct({ ...editProduct, imageUrl: data.url });
            } else {
                alert(data.error || "Gagal upload gambar");
            }
        } catch {
            alert("Terjadi kesalahan saat upload");
        } finally {
            setIsUploadingImage(false);
        }
    };

    const filtered = filterType
        ? products.filter((p) => p.type === filterType)
        : products;

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    const formatRupiah = (val: string | number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(val));
    };

    return (
        <div className="max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Kelola Produk Belanja</h2>
                <Button onClick={openAdd} className="cursor-pointer"><Plus className="mr-1 h-4 w-4" /> Bikin Produk</Button>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2">
                <button onClick={() => setFilterType("")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${!filterType ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Semua</button>
                <button onClick={() => setFilterType("fisik")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${filterType === "fisik" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Barang Fisik</button>
                <button onClick={() => setFilterType("virtual")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${filterType === "virtual" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Produk Virtual</button>
                <button onClick={() => setFilterType("jasa")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${filterType === "jasa" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Jasa Pemasangan</button>
            </div>

            {filtered.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Belum ada katalog produk</CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((product) => (
                        <Card key={product.id} className={`overflow-hidden transition-opacity ${!product.isActive && "opacity-60 grayscale-[0.2]"}`}>
                            <CardContent className="p-4 flex items-center gap-4">
                                {/* Thumbnail */}
                                {product.imageUrl ? (
                                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                                        <Image src={product.imageUrl} alt="" fill className="object-cover" unoptimized={true} />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shrink-0 flex items-center justify-center">
                                        <span className="text-white font-bold text-lg">{product.name.charAt(0)}</span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-sm truncate">{product.name}</p>
                                        <Badge variant={product.isActive ? "default" : "secondary"} className="text-xs shrink-0">
                                            {product.isActive ? "Aktif" : "Nonaktif"}
                                        </Badge>
                                        <Badge variant="outline" className={`text-xs shrink-0 ${product.type === "virtual" ? "text-blue-600" : product.type === "jasa" ? "text-orange-600" : ""}`}>
                                            {product.type.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-1 text-emerald-600 font-semibold">{formatRupiah(product.price)} &bull; Stok: {product.stock}</p>
                                    <p className="text-xs text-muted-foreground truncate">{product.description}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => toggleStatus(product)} className="p-2 rounded-lg hover:bg-muted cursor-pointer" title={product.isActive ? "Nonaktifkan" : "Aktifkan"}>
                                        {product.isActive ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                    </button>
                                    <button onClick={() => openEdit(product)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"><Pencil className="h-4 w-4" /></button>
                                    <button onClick={() => handleDelete(product.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Product Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Produk Belanja" : "Tambah Produk Baru"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label>Nama Produk</Label>
                                <Input value={editProduct.name || ""} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} placeholder="Voucher Tsel 5GB, Indomie..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Tipe</Label>
                                <select value={editProduct.type || "fisik"} onChange={(e) => setEditProduct({ ...editProduct, type: e.target.value as "fisik" | "virtual" | "jasa" })} className="w-full px-3 py-2 border rounded-md text-sm bg-white">
                                    <option value="fisik">Barang Fisik</option>
                                    <option value="virtual">Virtual (Auto-Redeem)</option>
                                    <option value="jasa">Jasa Pemasangan</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Harga (Rp)</Label>
                                <Input type="number" value={editProduct.price || ""} onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })} placeholder="15000" />
                            </div>
                            <div className="space-y-2">
                                <Label>Stok (Khusus Fisik/Jasa)</Label>
                                <Input type="number" value={editProduct.stock || ""} onChange={(e) => setEditProduct({ ...editProduct, stock: Number(e.target.value) })} placeholder="50" min={0} disabled={editProduct.type === "virtual"} />
                                {editProduct.type === "virtual" && (
                                    <p className="text-[10px] text-muted-foreground">Stok virtual dihitung otomatis dari tabel Voucher.</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Deskripsi Lengkap</Label>
                            <Textarea value={editProduct.description || ""} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })} rows={3} />
                        </div>

                        {/* Image Upload */}
                        <div className="space-y-2">
                            <Label>Gambar Produk</Label>
                            <div className="flex items-center gap-3">
                                <label className={`flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground ${isUploadingImage ? "opacity-50 pointer-events-none" : ""}`}>
                                    {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    <span>{isUploadingImage ? "Mengunggah..." : editProduct.imageUrl ? "Ganti gambar" : "Upload gambar"}</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} disabled={isUploadingImage} />
                                </label>
                                {editProduct.imageUrl && (
                                    <button onClick={() => setEditProduct({ ...editProduct, imageUrl: "" })} className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                                )}
                            </div>
                            {editProduct.imageUrl ? (
                                <div className="relative w-32 h-32 rounded-lg border overflow-hidden mt-3">
                                    <Image src={editProduct.imageUrl} alt="Produk" fill className="object-cover" unoptimized={true} />
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Batal</Button>
                        <Button onClick={handleSave} disabled={saving} className="cursor-pointer bg-red-600 hover:bg-red-700 text-white">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Simpan Data Produk
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
