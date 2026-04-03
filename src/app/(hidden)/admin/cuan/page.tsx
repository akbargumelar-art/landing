"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Filter,
    X,
    CheckSquare,
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

type SortField = "name" | "categoryName" | "brandName" | "capitalPrice" | "sellingPrice" | "cashback" | "profit" | "isHot" | "isActive";
type SortDir = "asc" | "desc";

const formatRupiah = (val: string | number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(val));

const getProfit = (p: CuanProduct) => Number(p.sellingPrice) - Number(p.capitalPrice) + Number(p.cashback);

export default function AdminCuanPage() {
    const [products, setProducts] = useState<CuanProduct[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeSubTab, setActiveSubTab] = useState<"products" | "categories" | "brands">("products");

    // Sort state
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    // Filter state
    const [filterCategory, setFilterCategory] = useState<string>("");
    const [filterBrand, setFilterBrand] = useState<string>("");

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkEditOpen, setBulkEditOpen] = useState(false);
    const [bulkForm, setBulkForm] = useState({
        categoryId: "",
        brandId: "",
        capitalPrice: "",
        sellingPrice: "",
        cashback: "",
        isActive: "" as "" | "true" | "false",
        isHot: "" as "" | "true" | "false",
    });
    const [bulkSubmitting, setBulkSubmitting] = useState(false);

    // Dialog states
    const [addProductOpen, setAddProductOpen] = useState(false);
    const [editProductOpen, setEditProductOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [addCategoryOpen, setAddCategoryOpen] = useState(false);
    const [editCategoryOpen, setEditCategoryOpen] = useState(false);
    const [addBrandOpen, setAddBrandOpen] = useState(false);
    const [editBrandOpen, setEditBrandOpen] = useState(false);

    // Form states
    const [form, setForm] = useState({ name: "", categoryId: "", brandId: "", capitalPrice: "", sellingPrice: "", cashback: "", isHot: false });
    const [editForm, setEditForm] = useState({ id: "", name: "", categoryId: "", brandId: "", capitalPrice: "", sellingPrice: "", cashback: "", isHot: false });
    const [newCategory, setNewCategory] = useState("");
    const [editCategoryForm, setEditCategoryForm] = useState({ id: "", name: "" });
    const [newBrand, setNewBrand] = useState("");
    const [editBrandForm, setEditBrandForm] = useState({ id: "", name: "" });
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

    // Clear selection when products change
    useEffect(() => { setSelectedIds(new Set()); }, [products]);

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

    const handleEditCategory = async () => {
        if (!editCategoryForm.name.trim()) return;
        await fetch(`/api/admin/cuan/categories/${editCategoryForm.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: editCategoryForm.name }),
        });
        setEditCategoryOpen(false);
        await fetchAll();
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        const count = products.filter(p => p.categoryId === id).length;
        if (count > 0) {
            alert(`Tidak bisa hapus kategori "${name}" karena masih digunakan oleh ${count} produk.`);
            return;
        }
        if (!confirm(`Hapus kategori "${name}"?`)) return;
        await fetch(`/api/admin/cuan/categories/${id}`, { method: "DELETE" });
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

    const handleEditBrand = async () => {
        if (!editBrandForm.name.trim()) return;
        await fetch(`/api/admin/cuan/brands/${editBrandForm.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: editBrandForm.name }),
        });
        setEditBrandOpen(false);
        await fetchAll();
    };

    const handleDeleteBrand = async (id: string, name: string) => {
        const count = products.filter(p => p.brandId === id).length;
        if (count > 0) {
            alert(`Tidak bisa hapus brand "${name}" karena masih digunakan oleh ${count} produk.`);
            return;
        }
        if (!confirm(`Hapus brand "${name}"?`)) return;
        await fetch(`/api/admin/cuan/brands/${id}`, { method: "DELETE" });
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

    // Sort handler
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-gray-400" />;
        return sortDir === "asc"
            ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-red-500" />
            : <ArrowDown className="h-3.5 w-3.5 ml-1 text-red-500" />;
    };

    // Filter + Search + Sort
    const processedProducts = useMemo(() => {
        let result = products.filter(p => {
            const matchSearch = !search ||
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.categoryName?.toLowerCase().includes(search.toLowerCase()) ||
                p.brandName?.toLowerCase().includes(search.toLowerCase());
            const matchCategory = !filterCategory || p.categoryId === filterCategory;
            const matchBrand = !filterBrand || p.brandId === filterBrand;
            return matchSearch && matchCategory && matchBrand;
        });

        if (sortField) {
            result = [...result].sort((a, b) => {
                let valA: string | number | boolean;
                let valB: string | number | boolean;

                switch (sortField) {
                    case "name":
                        valA = a.name.toLowerCase();
                        valB = b.name.toLowerCase();
                        break;
                    case "categoryName":
                        valA = (a.categoryName || "").toLowerCase();
                        valB = (b.categoryName || "").toLowerCase();
                        break;
                    case "brandName":
                        valA = (a.brandName || "").toLowerCase();
                        valB = (b.brandName || "").toLowerCase();
                        break;
                    case "capitalPrice":
                        valA = Number(a.capitalPrice);
                        valB = Number(b.capitalPrice);
                        break;
                    case "sellingPrice":
                        valA = Number(a.sellingPrice);
                        valB = Number(b.sellingPrice);
                        break;
                    case "cashback":
                        valA = Number(a.cashback);
                        valB = Number(b.cashback);
                        break;
                    case "profit":
                        valA = getProfit(a);
                        valB = getProfit(b);
                        break;
                    case "isHot":
                        valA = a.isHot ? 1 : 0;
                        valB = b.isHot ? 1 : 0;
                        break;
                    case "isActive":
                        valA = a.isActive ? 1 : 0;
                        valB = b.isActive ? 1 : 0;
                        break;
                    default:
                        return 0;
                }

                if (valA < valB) return sortDir === "asc" ? -1 : 1;
                if (valA > valB) return sortDir === "asc" ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [products, search, filterCategory, filterBrand, sortField, sortDir]);

    // Bulk selection helpers
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === processedProducts.length && processedProducts.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(processedProducts.map(p => p.id)));
        }
    };

    const isAllSelected = processedProducts.length > 0 && selectedIds.size === processedProducts.length;
    const hasSelection = selectedIds.size > 0;

    // Bulk delete
    const handleBulkDelete = async () => {
        if (!confirm(`Hapus ${selectedIds.size} produk yang dipilih?`)) return;
        try {
            await fetch("/api/admin/cuan/products/bulk", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            await fetchAll();
        } catch {
            alert("Gagal menghapus produk.");
        }
    };

    // Bulk edit
    const openBulkEdit = () => {
        setBulkForm({ categoryId: "", brandId: "", capitalPrice: "", sellingPrice: "", cashback: "", isActive: "", isHot: "" });
        setBulkEditOpen(true);
    };

    const handleBulkEdit = async () => {
        setBulkSubmitting(true);
        try {
            const data: Record<string, unknown> = {};
            if (bulkForm.categoryId) data.categoryId = bulkForm.categoryId;
            if (bulkForm.brandId) data.brandId = bulkForm.brandId;
            if (bulkForm.capitalPrice) data.capitalPrice = bulkForm.capitalPrice;
            if (bulkForm.sellingPrice) data.sellingPrice = bulkForm.sellingPrice;
            if (bulkForm.cashback) data.cashback = bulkForm.cashback;
            if (bulkForm.isActive !== "") data.isActive = bulkForm.isActive === "true";
            if (bulkForm.isHot !== "") data.isHot = bulkForm.isHot === "true";

            if (Object.keys(data).length === 0) {
                alert("Pilih minimal 1 field yang ingin diubah.");
                setBulkSubmitting(false);
                return;
            }

            await fetch("/api/admin/cuan/products/bulk", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds), data }),
            });
            setBulkEditOpen(false);
            await fetchAll();
        } catch {
            alert("Gagal update produk.");
        }
        setBulkSubmitting(false);
    };

    const activeFilterCount = (filterCategory ? 1 : 0) + (filterBrand ? 1 : 0);

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
                    {/* Search + Filters + Actions Row */}
                    <div className="flex flex-col gap-3">
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

                        {/* Filter Row */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Filter className="h-4 w-4" />
                                <span className="font-medium">Filter:</span>
                            </div>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-input text-sm bg-background hover:bg-accent transition-colors"
                            >
                                <option value="">Semua Kategori</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select
                                value={filterBrand}
                                onChange={(e) => setFilterBrand(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-input text-sm bg-background hover:bg-accent transition-colors"
                            >
                                <option value="">Semua Brand</option>
                                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            {activeFilterCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setFilterCategory(""); setFilterBrand(""); }}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                                >
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Reset ({activeFilterCount})
                                </Button>
                            )}
                            <div className="ml-auto text-xs text-muted-foreground">
                                {processedProducts.length} dari {products.length} produk
                            </div>
                        </div>
                    </div>

                    {/* Bulk Action Bar */}
                    {hasSelection && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200 animate-in fade-in slide-in-from-top-2 duration-200">
                            <CheckSquare className="h-5 w-5 text-red-600 shrink-0" />
                            <span className="text-sm font-semibold text-red-700">
                                {selectedIds.size} produk dipilih
                            </span>
                            <div className="flex items-center gap-2 ml-auto">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={openBulkEdit}
                                    className="border-red-200 text-red-700 hover:bg-red-100"
                                >
                                    <Edit className="h-4 w-4 mr-1.5" />
                                    Edit Massal
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleBulkDelete}
                                    className="border-red-300 text-red-700 hover:bg-red-100"
                                >
                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                    Hapus Massal
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedIds(new Set())}
                                    className="text-red-500 hover:text-red-600"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Products Table */}
                    <Card className="overflow-hidden">
                        {loading ? (
                            <div className="py-16 flex items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-red-600" />
                            </div>
                        ) : processedProducts.length === 0 ? (
                            <div className="py-16 text-center">
                                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-muted-foreground font-medium">Belum ada produk</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[40px]">
                                                <input
                                                    type="checkbox"
                                                    checked={isAllSelected}
                                                    onChange={toggleSelectAll}
                                                    className="w-4 h-4 accent-red-600 cursor-pointer"
                                                />
                                            </TableHead>
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>
                                                <button onClick={() => handleSort("name")} className="flex items-center font-semibold hover:text-red-600 transition-colors cursor-pointer">
                                                    Nama Produk
                                                    <SortIcon field="name" />
                                                </button>
                                            </TableHead>
                                            <TableHead>
                                                <button onClick={() => handleSort("categoryName")} className="flex items-center font-semibold hover:text-red-600 transition-colors cursor-pointer">
                                                    Kategori
                                                    <SortIcon field="categoryName" />
                                                </button>
                                            </TableHead>
                                            <TableHead>
                                                <button onClick={() => handleSort("brandName")} className="flex items-center font-semibold hover:text-red-600 transition-colors cursor-pointer">
                                                    Brand
                                                    <SortIcon field="brandName" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-right">
                                                <button onClick={() => handleSort("capitalPrice")} className="flex items-center justify-end font-semibold hover:text-red-600 transition-colors cursor-pointer ml-auto">
                                                    Harga Modal
                                                    <SortIcon field="capitalPrice" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-right">
                                                <button onClick={() => handleSort("sellingPrice")} className="flex items-center justify-end font-semibold hover:text-red-600 transition-colors cursor-pointer ml-auto">
                                                    Harga Jual
                                                    <SortIcon field="sellingPrice" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-right">
                                                <button onClick={() => handleSort("cashback")} className="flex items-center justify-end font-semibold hover:text-red-600 transition-colors cursor-pointer ml-auto">
                                                    Cashback
                                                    <SortIcon field="cashback" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-right">
                                                <button onClick={() => handleSort("profit")} className="flex items-center justify-end font-semibold hover:text-red-600 transition-colors cursor-pointer ml-auto">
                                                    Keuntungan
                                                    <SortIcon field="profit" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-center">
                                                <button onClick={() => handleSort("isHot")} className="flex items-center justify-center font-semibold hover:text-red-600 transition-colors cursor-pointer mx-auto">
                                                    Hot
                                                    <SortIcon field="isHot" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-center">
                                                <button onClick={() => handleSort("isActive")} className="flex items-center justify-center font-semibold hover:text-red-600 transition-colors cursor-pointer mx-auto">
                                                    Status
                                                    <SortIcon field="isActive" />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-center">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {processedProducts.map((p, i) => {
                                            const profit = getProfit(p);
                                            const isSelected = selectedIds.has(p.id);
                                            return (
                                                <TableRow key={p.id} className={isSelected ? "bg-red-50/50" : ""}>
                                                    <TableCell>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelect(p.id)}
                                                            className="w-4 h-4 accent-red-600 cursor-pointer"
                                                        />
                                                    </TableCell>
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
                        {categories.map(c => {
                            const productCount = products.filter(p => p.categoryId === c.id).length;
                            return (
                                <Card key={c.id} className="p-4 flex items-center gap-3 group">
                                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                        <Layers className="h-5 w-5 text-red-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{c.name}</p>
                                        <p className="text-xs text-muted-foreground">{productCount} produk</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            onClick={() => { setEditCategoryForm({ id: c.id, name: c.name }); setEditCategoryOpen(true); }}
                                            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer"
                                            title="Edit"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCategory(c.id, c.name)}
                                            className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-400 cursor-pointer"
                                            title="Hapus"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </Card>
                            );
                        })}
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
                        {brands.map(b => {
                            const productCount = products.filter(p => p.brandId === b.id).length;
                            return (
                                <Card key={b.id} className="p-4 flex items-center gap-3 group">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                        <Tag className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{b.name}</p>
                                        <p className="text-xs text-muted-foreground">{productCount} produk</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            onClick={() => { setEditBrandForm({ id: b.id, name: b.name }); setEditBrandOpen(true); }}
                                            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer"
                                            title="Edit"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBrand(b.id, b.name)}
                                            className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-400 cursor-pointer"
                                            title="Hapus"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </Card>
                            );
                        })}
                        {brands.length === 0 && (
                            <p className="text-sm text-muted-foreground col-span-full py-8 text-center">Belum ada brand</p>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Category Dialog */}
            <Dialog open={editCategoryOpen} onOpenChange={setEditCategoryOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Kategori</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Nama Kategori</Label>
                            <Input value={editCategoryForm.name} onChange={(e) => setEditCategoryForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <Button onClick={handleEditCategory} disabled={!editCategoryForm.name.trim()} className="w-full bg-red-600 hover:bg-red-700 text-white">
                            <Edit className="h-4 w-4 mr-2" />
                            Simpan Perubahan
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Brand Dialog */}
            <Dialog open={editBrandOpen} onOpenChange={setEditBrandOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Brand</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Nama Brand</Label>
                            <Input value={editBrandForm.name} onChange={(e) => setEditBrandForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <Button onClick={handleEditBrand} disabled={!editBrandForm.name.trim()} className="w-full bg-red-600 hover:bg-red-700 text-white">
                            <Edit className="h-4 w-4 mr-2" />
                            Simpan Perubahan
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

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

            {/* Bulk Edit Dialog */}
            <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Massal — {selectedIds.size} Produk</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Isi hanya field yang ingin diubah. Field yang kosong tidak akan berubah.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Kategori</Label>
                                <select
                                    value={bulkForm.categoryId}
                                    onChange={(e) => setBulkForm(f => ({ ...f, categoryId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-md border border-input text-sm"
                                >
                                    <option value="">— Tidak diubah —</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <Label>Brand</Label>
                                <select
                                    value={bulkForm.brandId}
                                    onChange={(e) => setBulkForm(f => ({ ...f, brandId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-md border border-input text-sm"
                                >
                                    <option value="">— Tidak diubah —</option>
                                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label>Harga Modal</Label>
                                <Input type="number" value={bulkForm.capitalPrice} onChange={(e) => setBulkForm(f => ({ ...f, capitalPrice: e.target.value }))} placeholder="Tidak diubah" />
                            </div>
                            <div>
                                <Label>Harga Jual</Label>
                                <Input type="number" value={bulkForm.sellingPrice} onChange={(e) => setBulkForm(f => ({ ...f, sellingPrice: e.target.value }))} placeholder="Tidak diubah" />
                            </div>
                            <div>
                                <Label>Cashback</Label>
                                <Input type="number" value={bulkForm.cashback} onChange={(e) => setBulkForm(f => ({ ...f, cashback: e.target.value }))} placeholder="Tidak diubah" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Status Aktif</Label>
                                <select
                                    value={bulkForm.isActive}
                                    onChange={(e) => setBulkForm(f => ({ ...f, isActive: e.target.value as "" | "true" | "false" }))}
                                    className="w-full px-3 py-2 rounded-md border border-input text-sm"
                                >
                                    <option value="">— Tidak diubah —</option>
                                    <option value="true">Aktif</option>
                                    <option value="false">Nonaktif</option>
                                </select>
                            </div>
                            <div>
                                <Label>Hot Produk</Label>
                                <select
                                    value={bulkForm.isHot}
                                    onChange={(e) => setBulkForm(f => ({ ...f, isHot: e.target.value as "" | "true" | "false" }))}
                                    className="w-full px-3 py-2 rounded-md border border-input text-sm"
                                >
                                    <option value="">— Tidak diubah —</option>
                                    <option value="true">Ya 🔥</option>
                                    <option value="false">Tidak</option>
                                </select>
                            </div>
                        </div>
                        <Button onClick={handleBulkEdit} disabled={bulkSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white">
                            {bulkSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckSquare className="h-4 w-4 mr-2" />}
                            Terapkan ke {selectedIds.size} Produk
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
