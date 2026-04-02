"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Plus,
    Upload,
    Trash2,
    Edit,
    Loader2,
    Package,
    Tag,
    Layers,
    RefreshCw,
    FileSpreadsheet,
    Download,
    CheckCircle,
    XCircle,
    Search,
    Flame,
} from "lucide-react";

interface CuanProduct {
    id: string;
    name: string;
    categoryId: string;
    categoryName: string;
    brandId: string;
    brandName: string;
    capitalPrice: string;
    sellingPrice: string;
    cashback: string;
    isActive: boolean;
    isHot: boolean;
}

interface Category {
    id: string;
    name: string;
}

interface Brand {
    id: string;
    name: string;
}

const formatRupiah = (val: string | number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(val));

export default function AdminCuanPage() {
    const [products, setProducts] = useState<CuanProduct[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeSubTab, setActiveSubTab] = useState<"products" | "categories" | "brands">("products");

    // Dialog states
    const [addProductOpen, setAddProductOpen] = useState(false);
    const [editProductOpen, setEditProductOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [addCategoryOpen, setAddCategoryOpen] = useState(false);
    const [addBrandOpen, setAddBrandOpen] = useState(false);

    // Form states
    const [form, setForm] = useState({ name: "", categoryId: "", brandId: "", capitalPrice: "", sellingPrice: "", cashback: "", isHot: false });
    const [editForm, setEditForm] = useState({ id: "", name: "", categoryId: "", brandId: "", capitalPrice: "", sellingPrice: "", cashback: "", isHot: false });
    const [newCategory, setNewCategory] = useState("");
    const [newBrand, setNewBrand] = useState("");
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [prodRes, catRes, brandRes] = await Promise.all([
                fetch("/api/admin/cuan/products"),
                fetch("/api/admin/cuan/categories"),
                fetch("/api/admin/cuan/brands"),
            ]);
            setProducts(await prodRes.json());
            setCategories(await catRes.json());
            setBrands(await brandRes.json());
        } catch { /* empty */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleAddProduct = async () => {
        setSubmitting(true);
        try {
            await fetch("/api/admin/cuan/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            setForm({ name: "", categoryId: "", brandId: "", capitalPrice: "", sellingPrice: "", cashback: "", isHot: false });
            setAddProductOpen(false);
            await fetchAll();
        } catch { /* empty */ }
        setSubmitting(false);
    };

    const handleEditProduct = async () => {
        setSubmitting(true);
        try {
            await fetch(`/api/admin/cuan/products/${editForm.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm),
            });
            setEditProductOpen(false);
            await fetchAll();
        } catch { /* empty */ }
        setSubmitting(false);
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm("Hapus produk ini?")) return;
        await fetch(`/api/admin/cuan/products/${id}`, { method: "DELETE" });
        await fetchAll();
    };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        await fetch(`/api/admin/cuan/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !isActive }),
        });
        await fetchAll();
    };

    const handleToggleHot = async (id: string, isHot: boolean) => {
        await fetch(`/api/admin/cuan/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isHot: !isHot }),
        });
        await fetchAll();
    };

    const handleAddCategory = async () => {
        if (!newCategory.trim()) return;
        await fetch("/api/admin/cuan/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newCategory }),
        });
        setNewCategory("");
        setAddCategoryOpen(false);
        await fetchAll();
    };

    const handleAddBrand = async () => {
        if (!newBrand.trim()) return;
        await fetch("/api/admin/cuan/brands", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newBrand }),
        });
        setNewBrand("");
        setAddBrandOpen(false);
        await fetchAll();
    };

    const handleUpload = async () => {
        if (!uploadFile) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", uploadFile);
            const res = await fetch("/api/admin/cuan/products/upload", { method: "POST", body: fd });
            const data = await res.json();
            alert(`Berhasil import ${data.imported} produk. ${data.skipped > 0 ? `${data.skipped} baris dilewati.` : ""}`);
            setUploadFile(null);
            setUploadOpen(false);
            await fetchAll();
        } catch {
            alert("Gagal upload file.");
        }
        setUploading(false);
    };

    const downloadTemplate = () => {
        import("xlsx").then((XLSX) => {
            const data = [
                { Nama: "Paket Internet 5GB", Kategori: "Paket Internet", Brand: "Simpati", "Harga Modal": 25000, "Harga Jual": 30000, Cashback: 1000, "Hot Produk": "Ya" },
                { Nama: "Pulsa 50rb", Kategori: "Pulsa", Brand: "byU", "Harga Modal": 49000, "Harga Jual": 50000, Cashback: 500, "Hot Produk": "" },
            ];
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Template");
            XLSX.writeFile(wb, "template-produk-cuan.xlsx");
        });
    };

    const openEdit = (p: CuanProduct) => {
        setEditForm({
            id: p.id,
            name: p.name,
            categoryId: p.categoryId,
            brandId: p.brandId,
            capitalPrice: p.capitalPrice,
            sellingPrice: p.sellingPrice,
            cashback: p.cashback,
            isHot: p.isHot,
        });
        setEditProductOpen(true);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.categoryName?.toLowerCase().includes(search.toLowerCase()) ||
        p.brandName?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Master Produk Cuan</h1>
                    <p className="text-sm text-muted-foreground mt-1">Kelola data produk untuk Kalkulator Cuan DigiposAja</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex items-center gap-2 border-b border-border pb-1">
                <button
                    onClick={() => setActiveSubTab("products")}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeSubTab === "products" ? "border-red-600 text-red-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                    <Package className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                    Produk ({products.length})
                </button>
                <button
                    onClick={() => setActiveSubTab("categories")}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeSubTab === "categories" ? "border-red-600 text-red-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                    <Layers className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                    Kategori ({categories.length})
                </button>
                <button
                    onClick={() => setActiveSubTab("brands")}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeSubTab === "brands" ? "border-red-600 text-red-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                    <Tag className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                    Brand ({brands.length})
                </button>
            </div>

            {/* PRODUCTS TAB */}
            {activeSubTab === "products" && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari produk, kategori, brand..."
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Upload Excel Dialog */}
                            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Upload className="h-4 w-4 mr-1.5" />
                                        Upload Excel
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Upload Data Produk via Excel</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Upload file Excel (.xlsx) dengan kolom: <strong>Nama, Kategori, Brand, Harga Modal, Harga Jual, Cashback</strong>
                                            </p>
                                            <Button variant="outline" size="sm" onClick={downloadTemplate} className="mb-3">
                                                <Download className="h-4 w-4 mr-1.5" />
                                                Download Template
                                            </Button>
                                        </div>
                                        <Input
                                            type="file"
                                            accept=".xlsx,.xls"
                                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                        />
                                        <Button onClick={handleUpload} disabled={!uploadFile || uploading} className="w-full bg-red-600 hover:bg-red-700 text-white">
                                            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                                            {uploading ? "Mengupload..." : "Upload & Import"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            {/* Add Product Dialog */}
                            <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                                        <Plus className="h-4 w-4 mr-1.5" />
                                        Tambah Produk
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Tambah Produk Baru</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <div>
                                            <Label>Nama Produk</Label>
                                            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Paket Internet 5GB" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label>Kategori</Label>
                                                <select
                                                    value={form.categoryId}
                                                    onChange={(e) => setForm(f => ({ ...f, categoryId: e.target.value }))}
                                                    className="w-full px-3 py-2 rounded-md border border-input text-sm"
                                                >
                                                    <option value="">Pilih...</option>
                                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <Label>Brand</Label>
                                                <select
                                                    value={form.brandId}
                                                    onChange={(e) => setForm(f => ({ ...f, brandId: e.target.value }))}
                                                    className="w-full px-3 py-2 rounded-md border border-input text-sm"
                                                >
                                                    <option value="">Pilih...</option>
                                                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <Label>Harga Modal</Label>
                                                <Input type="number" value={form.capitalPrice} onChange={(e) => setForm(f => ({ ...f, capitalPrice: e.target.value }))} placeholder="25000" />
                                            </div>
                                            <div>
                                                <Label>Harga Jual</Label>
                                                <Input type="number" value={form.sellingPrice} onChange={(e) => setForm(f => ({ ...f, sellingPrice: e.target.value }))} placeholder="30000" />
                                            </div>
                                            <div>
                                                <Label>Cashback</Label>
                                                <Input type="number" value={form.cashback} onChange={(e) => setForm(f => ({ ...f, cashback: e.target.value }))} placeholder="1000" />
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-orange-50 transition-colors">
                                            <input type="checkbox" checked={form.isHot} onChange={(e) => setForm(f => ({ ...f, isHot: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
                                            <Flame className={`h-4 w-4 ${form.isHot ? 'text-orange-500 fill-orange-500' : 'text-gray-400'}`} />
                                            <span className="text-sm font-medium">Tandai sebagai <span className="text-orange-600 font-bold">Hot Produk</span> 🔥</span>
                                        </label>
                                        {form.capitalPrice && form.sellingPrice && (
                                            <div className="bg-emerald-50 p-3 rounded-lg text-sm">
                                                <span className="text-emerald-700 font-semibold">
                                                    Keuntungan per unit: {formatRupiah((Number(form.sellingPrice) - Number(form.capitalPrice)) + Number(form.cashback || 0))}
                                                </span>
                                            </div>
                                        )}
                                        <Button onClick={handleAddProduct} disabled={submitting || !form.name || !form.categoryId || !form.brandId} className="w-full bg-red-600 hover:bg-red-700 text-white">
                                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                            Simpan Produk
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                    {/* Products Table */}
                    <Card className="overflow-hidden">
                        {loading ? (
                            <div className="py-16 flex items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="py-16 text-center">
                                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-muted-foreground font-medium">Belum ada produk</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>Nama Produk</TableHead>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead>Brand</TableHead>
                                            <TableHead className="text-right">Harga Modal</TableHead>
                                            <TableHead className="text-right">Harga Jual</TableHead>
                                            <TableHead className="text-right">Cashback</TableHead>
                                            <TableHead className="text-right">Keuntungan</TableHead>
                                            <TableHead className="text-center">Hot</TableHead>
                                            <TableHead className="text-center">Status</TableHead>
                                            <TableHead className="text-center">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProducts.map((p, i) => {
                                            const profit = Number(p.sellingPrice) - Number(p.capitalPrice) + Number(p.cashback);
                                            return (
                                                <TableRow key={p.id}>
                                                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                                    <TableCell className="font-medium">{p.name}</TableCell>
                                                    <TableCell><Badge variant="secondary" className="text-xs">{p.categoryName}</Badge></TableCell>
                                                    <TableCell><Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">{p.brandName}</Badge></TableCell>
                                                    <TableCell className="text-right text-sm">{formatRupiah(p.capitalPrice)}</TableCell>
                                                    <TableCell className="text-right text-sm">{formatRupiah(p.sellingPrice)}</TableCell>
                                                    <TableCell className="text-right text-sm">{formatRupiah(p.cashback)}</TableCell>
                                                    <TableCell className="text-right text-sm font-bold text-emerald-600">{formatRupiah(profit)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <button onClick={() => handleToggleHot(p.id, p.isHot)} className="cursor-pointer" title={p.isHot ? "Nonaktifkan Hot" : "Tandai Hot"}>
                                                            <Flame className={`h-5 w-5 mx-auto transition-colors ${p.isHot ? "text-orange-500 fill-orange-500" : "text-gray-300"}`} />
                                                        </button>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <button onClick={() => handleToggleActive(p.id, p.isActive)} className="cursor-pointer">
                                                            {p.isActive ? (
                                                                <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto" />
                                                            ) : (
                                                                <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                                                            )}
                                                        </button>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer">
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button onClick={() => handleDeleteProduct(p.id)} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-400 cursor-pointer">
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* CATEGORIES TAB */}
            {activeSubTab === "categories" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Kelola kategori produk untuk Kalkulator Cuan</p>
                        <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Tambah Kategori
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Tambah Kategori</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Nama Kategori</Label>
                                        <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Paket Internet" />
                                    </div>
                                    <Button onClick={handleAddCategory} disabled={!newCategory.trim()} className="w-full bg-red-600 hover:bg-red-700 text-white">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Simpan
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {categories.map(c => (
                            <Card key={c.id} className="p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                                    <Layers className="h-5 w-5 text-red-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{c.name}</p>
                                    <p className="text-xs text-muted-foreground">{products.filter(p => p.categoryId === c.id).length} produk</p>
                                </div>
                            </Card>
                        ))}
                        {categories.length === 0 && (
                            <p className="text-sm text-muted-foreground col-span-full py-8 text-center">Belum ada kategori</p>
                        )}
                    </div>
                </div>
            )}

            {/* BRANDS TAB */}
            {activeSubTab === "brands" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Kelola brand/merek produk untuk Kalkulator Cuan</p>
                        <Dialog open={addBrandOpen} onOpenChange={setAddBrandOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Tambah Brand
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Tambah Brand</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Nama Brand</Label>
                                        <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Simpati" />
                                    </div>
                                    <Button onClick={handleAddBrand} disabled={!newBrand.trim()} className="w-full bg-red-600 hover:bg-red-700 text-white">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Simpan
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {brands.map(b => (
                            <Card key={b.id} className="p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <Tag className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{b.name}</p>
                                    <p className="text-xs text-muted-foreground">{products.filter(p => p.brandId === b.id).length} produk</p>
                                </div>
                            </Card>
                        ))}
                        {brands.length === 0 && (
                            <p className="text-sm text-muted-foreground col-span-full py-8 text-center">Belum ada brand</p>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Product Dialog */}
            <Dialog open={editProductOpen} onOpenChange={setEditProductOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Produk</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Nama Produk</Label>
                            <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Kategori</Label>
                                <select
                                    value={editForm.categoryId}
                                    onChange={(e) => setEditForm(f => ({ ...f, categoryId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-md border border-input text-sm"
                                >
                                    <option value="">Pilih...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <Label>Brand</Label>
                                <select
                                    value={editForm.brandId}
                                    onChange={(e) => setEditForm(f => ({ ...f, brandId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-md border border-input text-sm"
                                >
                                    <option value="">Pilih...</option>
                                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label>Harga Modal</Label>
                                <Input type="number" value={editForm.capitalPrice} onChange={(e) => setEditForm(f => ({ ...f, capitalPrice: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Harga Jual</Label>
                                <Input type="number" value={editForm.sellingPrice} onChange={(e) => setEditForm(f => ({ ...f, sellingPrice: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Cashback</Label>
                                <Input type="number" value={editForm.cashback} onChange={(e) => setEditForm(f => ({ ...f, cashback: e.target.value }))} />
                            </div>
                        </div>
                        <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-orange-50 transition-colors">
                            <input type="checkbox" checked={editForm.isHot} onChange={(e) => setEditForm(f => ({ ...f, isHot: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
                            <Flame className={`h-4 w-4 ${editForm.isHot ? 'text-orange-500 fill-orange-500' : 'text-gray-400'}`} />
                            <span className="text-sm font-medium">Tandai sebagai <span className="text-orange-600 font-bold">Hot Produk</span> 🔥</span>
                        </label>
                        {editForm.capitalPrice && editForm.sellingPrice && (
                            <div className="bg-emerald-50 p-3 rounded-lg text-sm">
                                <span className="text-emerald-700 font-semibold">
                                    Keuntungan per unit: {formatRupiah((Number(editForm.sellingPrice) - Number(editForm.capitalPrice)) + Number(editForm.cashback || 0))}
                                </span>
                            </div>
                        )}
                        <Button onClick={handleEditProduct} disabled={submitting} className="w-full bg-red-600 hover:bg-red-700 text-white">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
                            Simpan Perubahan
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
