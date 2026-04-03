"use client";

import Image from "next/image";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Calculator,
    TrendingUp,
    ShoppingCart,
    Sparkles,
    Download,
    Plus,
    Minus,
    Search,
    Filter,
    Coins,
    Wallet,
    ArrowRight,
    RotateCcw,
    Loader2,
    Package,
    CheckCircle2,
    AlertCircle,
    Flame,
    MessageCircle,
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

interface CartItem {
    product: CuanProduct;
    qty: number;
}

const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(val);

const getProfit = (p: CuanProduct) =>
    Number(p.sellingPrice) - Number(p.capitalPrice) + Number(p.cashback);

const getProfitRatio = (p: CuanProduct) => {
    const capital = Number(p.capitalPrice);
    if (capital <= 0) return 0;
    return getProfit(p) / capital;
};

export default function KalkulatorCuanPage() {
    const [products, setProducts] = useState<CuanProduct[]>([]);
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<string>("");
    const [activeTab, setActiveTab] = useState<"rekomendasi" | "pilih">("rekomendasi");
    const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
    const [recommended, setRecommended] = useState<CartItem[] | null>(null);
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [filterBrand, setFilterBrand] = useState("all");
    const [isCalculating, setIsCalculating] = useState(false);

    // Rekomendasi tab filters (multi-select)
    const [rekoFilterCategories, setRekoFilterCategories] = useState<Set<string>>(new Set());
    const [rekoFilterBrands, setRekoFilterBrands] = useState<Set<string>>(new Set());
    const [rekoFilterHot, setRekoFilterHot] = useState(false);

    const toggleRekoCategory = (id: string) => {
        setRekoFilterCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleRekoBrand = (id: string) => {
        setRekoFilterBrands(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    useEffect(() => {
        fetch("/api/public/cuan/products")
            .then((r) => r.json())
            .then((data: CuanProduct[]) => {
                setProducts(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetch("/api/public/settings")
            .then((r) => r.json())
            .then((data: Record<string, string>) => setSettings(data))
            .catch(() => setSettings({}));
    }, []);

    const modalNum = useMemo(() => {
        const cleaned = modal.replace(/[^0-9]/g, "");
        return parseInt(cleaned) || 0;
    }, [modal]);

    // Interconnected filters: each list is filtered by the other's selection
    const categories = useMemo(() => {
        const catMap = new Map<string, string>();
        const filtered = filterBrand !== "all" ? products.filter((p) => p.brandId === filterBrand) : products;
        filtered.forEach((p) => catMap.set(p.categoryId, p.categoryName));
        return Array.from(catMap.entries()).map(([id, name]) => ({ id, name }));
    }, [products, filterBrand]);

    const brands = useMemo(() => {
        const brandMap = new Map<string, string>();
        const filtered = filterCategory !== "all" ? products.filter((p) => p.categoryId === filterCategory) : products;
        filtered.forEach((p) => brandMap.set(p.brandId, p.brandName));
        return Array.from(brandMap.entries()).map(([id, name]) => ({ id, name }));
    }, [products, filterCategory]);

    // All categories & brands for Rekomendasi filter (unlinked)
    const allCategories = useMemo(() => {
        const catMap = new Map<string, string>();
        products.forEach((p) => catMap.set(p.categoryId, p.categoryName));
        return Array.from(catMap.entries()).map(([id, name]) => ({ id, name }));
    }, [products]);

    const allBrands = useMemo(() => {
        const brandMap = new Map<string, string>();
        products.forEach((p) => brandMap.set(p.brandId, p.brandName));
        return Array.from(brandMap.entries()).map(([id, name]) => ({ id, name }));
    }, [products]);

    // Auto-reset filter if current selection is no longer available
    useEffect(() => {
        if (filterCategory !== "all" && !categories.find((c) => c.id === filterCategory)) {
            setFilterCategory("all");
        }
    }, [categories, filterCategory]);

    useEffect(() => {
        if (filterBrand !== "all" && !brands.find((b) => b.id === filterBrand)) {
            setFilterBrand("all");
        }
    }, [brands, filterBrand]);

    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            if (filterCategory !== "all" && p.categoryId !== filterCategory) return false;
            if (filterBrand !== "all" && p.brandId !== filterBrand) return false;
            if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [products, filterCategory, filterBrand, search]);

    // Cart calculations for Manual mode
    const cartSummary = useMemo(() => {
        let totalCapital = 0;
        let totalProfit = 0;

        cart.forEach((item) => {
            totalCapital += Number(item.product.capitalPrice) * item.qty;
            totalProfit += getProfit(item.product) * item.qty;
        });

        return {
            totalCapital,
            totalProfit,
            remaining: modalNum - totalCapital,
            totalItems: Array.from(cart.values()).reduce((s, i) => s + i.qty, 0),
        };
    }, [cart, modalNum]);

    // Recommendation algorithm
    const calculateRecommendation = useCallback(() => {
        if (modalNum <= 0) return;
        setIsCalculating(true);

        setTimeout(() => {
            const sortedProducts = [...products]
                .filter((p) => {
                    if (Number(p.capitalPrice) <= 0 || Number(p.capitalPrice) > modalNum) return false;
                    if (rekoFilterCategories.size > 0 && !rekoFilterCategories.has(p.categoryId)) return false;
                    if (rekoFilterBrands.size > 0 && !rekoFilterBrands.has(p.brandId)) return false;
                    if (rekoFilterHot && !p.isHot) return false;
                    return true;
                })
                .sort((a, b) => getProfitRatio(b) - getProfitRatio(a));

            let remainingBudget = modalNum;
            const result: CartItem[] = [];

            for (const product of sortedProducts) {
                const capital = Number(product.capitalPrice);
                if (capital <= 0) continue;

                const maxQty = Math.floor(remainingBudget / capital);
                if (maxQty > 0) {
                    result.push({ product, qty: maxQty });
                    remainingBudget -= capital * maxQty;
                }

                if (remainingBudget <= 0) break;
            }

            setRecommended(result);
            setIsCalculating(false);
        }, 600);
    }, [products, modalNum, rekoFilterCategories, rekoFilterBrands, rekoFilterHot]);

    const recommendedSummary = useMemo(() => {
        if (!recommended) return null;
        let totalCapital = 0;
        let totalProfit = 0;

        recommended.forEach((item) => {
            totalCapital += Number(item.product.capitalPrice) * item.qty;
            totalProfit += getProfit(item.product) * item.qty;
        });

        return {
            totalCapital,
            totalProfit,
            remaining: modalNum - totalCapital,
            totalItems: recommended.reduce((s, i) => s + i.qty, 0),
        };
    }, [recommended, modalNum]);

    const addToCart = (product: CuanProduct) => {
        const capital = Number(product.capitalPrice);
        if (capital > cartSummary.remaining) return;

        setCart((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(product.id);
            if (existing) {
                newMap.set(product.id, { ...existing, qty: existing.qty + 1 });
            } else {
                newMap.set(product.id, { product, qty: 1 });
            }
            return newMap;
        });
    };

    const removeFromCart = (productId: string) => {
        setCart((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(productId);
            if (existing && existing.qty > 1) {
                newMap.set(productId, { ...existing, qty: existing.qty - 1 });
            } else {
                newMap.delete(productId);
            }
            return newMap;
        });
    };

    const resetAll = () => {
        setCart(new Map());
        setRecommended(null);
        setModal("");
        setSearch("");
        setFilterCategory("all");
        setFilterBrand("all");
        setRekoFilterCategories(new Set());
        setRekoFilterBrands(new Set());
        setRekoFilterHot(false);
    };

    const rekoActiveFilterCount = rekoFilterCategories.size + rekoFilterBrands.size + (rekoFilterHot ? 1 : 0);

    const exportExcel = async (items: CartItem[], summary: { totalCapital: number; totalProfit: number; remaining: number }) => {
        const XLSX = await import("xlsx");

        const data = items.map((item) => ({
            "Nama Produk": item.product.name,
            Kategori: item.product.categoryName,
            Brand: item.product.brandName,
            "Harga Modal": Number(item.product.capitalPrice),
            "Harga Jual": Number(item.product.sellingPrice),
            Cashback: Number(item.product.cashback),
            "Keuntungan/Unit": getProfit(item.product),
            Qty: item.qty,
            "Subtotal Modal": Number(item.product.capitalPrice) * item.qty,
            "Subtotal Keuntungan": getProfit(item.product) * item.qty,
        }));

        data.push({
            "Nama Produk": "",
            Kategori: "",
            Brand: "",
            "Harga Modal": 0,
            "Harga Jual": 0,
            Cashback: 0,
            "Keuntungan/Unit": 0,
            Qty: 0,
            "Subtotal Modal": 0,
            "Subtotal Keuntungan": 0,
        });
        data.push({
            "Nama Produk": "TOTAL",
            Kategori: "",
            Brand: "",
            "Harga Modal": 0,
            "Harga Jual": 0,
            Cashback: 0,
            "Keuntungan/Unit": 0,
            Qty: items.reduce((s, i) => s + i.qty, 0),
            "Subtotal Modal": summary.totalCapital,
            "Subtotal Keuntungan": summary.totalProfit,
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Simulasi Cuan");
        XLSX.writeFile(wb, `kalkulator-cuan-${Date.now()}.xlsx`);
    };

    const handleModalInput = (value: string) => {
        const cleaned = value.replace(/[^0-9]/g, "");
        if (cleaned === "") {
            setModal("");
            return;
        }
        const num = parseInt(cleaned);
        setModal(num.toLocaleString("id-ID"));
    };

    const currentItems = activeTab === "rekomendasi" ? recommended : Array.from(cart.values());
    const currentSummary =
        activeTab === "rekomendasi"
            ? recommendedSummary
            : { totalCapital: cartSummary.totalCapital, totalProfit: cartSummary.totalProfit, remaining: cartSummary.remaining };
    const whatsappNumber = settings.whatsapp || "+62 851-6882-2280";
    const whatsappUrl = settings.whatsapp_url || "https://wa.me/6285168822280";

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <section className="relative bg-gradient-to-br from-red-700 via-red-600 to-orange-500 overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
                    <div className="absolute bottom-10 right-10 w-96 h-96 bg-yellow-300 rounded-full blur-3xl" />
                </div>
                <div className="relative max-w-5xl mx-auto px-4 py-16 md:py-24 text-center">
                    <div className="mb-6 flex justify-center">
                        <Image
                            src="/digiposaja-logo.png"
                            alt="Logo DigiposAja"
                            width={5247}
                            height={2355}
                            sizes="(max-width: 768px) 190px, 260px"
                            priority
                            className="h-auto w-full max-w-[190px] drop-shadow-[0_14px_28px_rgba(0,0,0,0.18)] md:max-w-[260px]"
                        />
                    </div>
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white/90 text-sm font-semibold mb-6">
                        <Sparkles className="h-4 w-4" />
                        Fitur DigiposAja
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
                        Kalkulator{" "}
                        <span className="text-yellow-300">Cuan</span>
                    </h1>
                    <p className="text-lg md:text-xl text-red-100 max-w-2xl mx-auto leading-relaxed">
                        Hitung potensi keuntunganmu dari setiap transaksi DigiposAja. Masukkan modal, pilih produk, dan lihat estimasi cuan-mu!
                    </p>
                </div>
                {/* Wave Divider */}
                <div className="wave-divider">
                    <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" fill="#f9fafb" opacity=".8" />
                        <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" fill="#f9fafb" opacity=".5" />
                        <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" fill="#f9fafb" />
                    </svg>
                </div>
            </section>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 md:pb-12">
                <div className="relative z-10 -mt-10 mb-8 md:-mt-16 md:mb-10">
                    <div className="mx-auto max-w-3xl overflow-hidden rounded-[28px] bg-gradient-to-r from-red-600 via-red-500 to-orange-500 shadow-[0_24px_60px_rgba(234,88,12,0.28)]">
                        <div className="flex items-center gap-3 px-5 pb-3 pt-5 text-white md:px-6">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-sm">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                                <p className="text-base font-black leading-tight md:text-lg">Masukkan Modal Awal (Rp)</p>
                                <p className="text-xs text-white/80 md:text-sm">Isi modal dulu sebelum mulai hitung cuan.</p>
                            </div>
                        </div>

                        <div className="rounded-t-[34px] bg-white/92 px-3 pb-4 pt-3 backdrop-blur-sm md:px-4">
                            <div className="relative">
                                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">
                                    Rp
                                </div>
                                <Input
                                    value={modal}
                                    onChange={(e) => handleModalInput(e.target.value)}
                                    placeholder="500.000"
                                    className="h-16 rounded-[22px] border-0 bg-white pl-14 pr-4 text-2xl font-black text-slate-700 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] placeholder:text-slate-400 focus-visible:ring-4 focus-visible:ring-orange-200 md:h-[72px] md:text-[2rem]"
                                />
                            </div>
                            {modalNum > 0 && (
                                <p className="px-2 pt-3 text-left text-sm font-semibold text-red-600">
                                    Modal aktif: {formatRupiah(modalNum)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {modalNum <= 0 ? (
                    <div className="text-center py-20">
                        <div className="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <Wallet className="h-12 w-12 text-red-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Masukkan Modal Awal</h2>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Isi nominal modal pada panel di atas untuk mulai menghitung potensi keuntunganmu dari transaksi DigiposAja.
                        </p>
                    </div>
                ) : loading ? (
                    <div className="py-24 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-red-600" />
                        <p className="text-muted-foreground font-medium">Memuat data produk...</p>
                    </div>
                ) : (
                    <>
                        {/* Mode Tabs */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
                            <button
                                onClick={() => { setActiveTab("rekomendasi"); setRecommended(null); }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${activeTab === "rekomendasi"
                                    ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-200 scale-105"
                                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm"
                                    }`}
                            >
                                <Sparkles className="h-4 w-4" />
                                Rekomendasi Cuan Maksimal
                            </button>
                            <button
                                onClick={() => { setActiveTab("pilih"); setCart(new Map()); }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${activeTab === "pilih"
                                    ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-200 scale-105"
                                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm"
                                    }`}
                            >
                                <ShoppingCart className="h-4 w-4" />
                                Pilih Sendiri
                            </button>
                            <button
                                onClick={resetAll}
                                className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-all"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Reset
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left: Products / Recommendation */}
                            <div className="lg:col-span-2">
                                {activeTab === "rekomendasi" ? (
                                    <div>
                                        {!recommended ? (
                                            <Card className="p-5 sm:p-8 md:p-12 bg-white border border-gray-100 shadow-sm">
                                                <div className="text-center">
                                                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                                        <Calculator className="h-10 w-10 text-orange-500" />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-gray-800 mb-2">Siap Hitung Cuan?</h3>
                                                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                                        Sistem akan otomatis mencarikan kombinasi produk dengan keuntungan maksimal berdasarkan modal <span className="font-bold text-red-600">{formatRupiah(modalNum)}</span>
                                                    </p>
                                                </div>

                                                {/* Optional Filters */}
                                                <div className="mb-6 space-y-3">
                                                    <div className="flex items-center gap-2 justify-center">
                                                        <Filter className="h-4 w-4 text-gray-400" />
                                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter Opsional</span>
                                                        {rekoActiveFilterCount > 0 && (
                                                            <button
                                                                onClick={() => { setRekoFilterCategories(new Set()); setRekoFilterBrands(new Set()); setRekoFilterHot(false); }}
                                                                className="text-xs text-red-500 hover:text-red-600 font-semibold cursor-pointer"
                                                            >
                                                                Reset ({rekoActiveFilterCount})
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Brand Filter (multi-select) */}
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 mb-1.5 text-center">Brand {rekoFilterBrands.size > 0 && <span className="text-red-500">({rekoFilterBrands.size} dipilih)</span>}</p>
                                                        <div className="flex flex-wrap gap-1.5 justify-center">
                                                            <button
                                                                onClick={() => setRekoFilterBrands(new Set())}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                                                                    rekoFilterBrands.size === 0
                                                                        ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md"
                                                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                                }`}
                                                            >
                                                                Semua
                                                            </button>
                                                            {allBrands.map((b) => (
                                                                <button
                                                                    key={b.id}
                                                                    onClick={() => toggleRekoBrand(b.id)}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                                                                        rekoFilterBrands.has(b.id)
                                                                            ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md"
                                                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                                    }`}
                                                                >
                                                                    {b.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Category Filter (multi-select) */}
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 mb-1.5 text-center">Kategori {rekoFilterCategories.size > 0 && <span className="text-red-500">({rekoFilterCategories.size} dipilih)</span>}</p>
                                                        <div className="flex flex-wrap gap-1.5 justify-center">
                                                            <button
                                                                onClick={() => setRekoFilterCategories(new Set())}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                                                                    rekoFilterCategories.size === 0
                                                                        ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md"
                                                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                                }`}
                                                            >
                                                                Semua
                                                            </button>
                                                            {allCategories.map((c) => (
                                                                <button
                                                                    key={c.id}
                                                                    onClick={() => toggleRekoCategory(c.id)}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                                                                        rekoFilterCategories.has(c.id)
                                                                            ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md"
                                                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                                    }`}
                                                                >
                                                                    {c.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Hot Produk Toggle */}
                                                    <div className="flex justify-center">
                                                        <button
                                                            onClick={() => setRekoFilterHot(!rekoFilterHot)}
                                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                                                                rekoFilterHot
                                                                    ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md"
                                                                    : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600"
                                                            }`}
                                                        >
                                                            <Flame className={`h-3.5 w-3.5 ${rekoFilterHot ? "fill-white" : ""}`} />
                                                            Hot Produk Saja 🔥
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="text-center">
                                                    <Button
                                                        onClick={calculateRecommendation}
                                                        disabled={isCalculating || products.length === 0}
                                                        className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white px-8 py-6 rounded-2xl text-base font-bold shadow-lg shadow-red-200 transition-all duration-300 hover:scale-105"
                                                    >
                                                        {isCalculating ? (
                                                            <>
                                                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                                                Menghitung...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="h-5 w-5 mr-2" />
                                                                Hitungkan Cuan Maksimal
                                                            </>
                                                        )}
                                                    </Button>
                                                    {rekoActiveFilterCount > 0 && (
                                                        <p className="text-xs text-gray-500 mt-3">
                                                            🔍 Menghitung hanya dari produk yang sesuai filter
                                                        </p>
                                                    )}
                                                </div>
                                                {products.length === 0 && (
                                                    <p className="text-sm text-red-500 mt-4 flex items-center justify-center gap-1">
                                                        <AlertCircle className="h-4 w-4" />
                                                        Belum ada data produk. Hubungi admin.
                                                    </p>
                                                )}
                                            </Card>
                                        ) : recommended.length === 0 ? (
                                            <Card className="p-8 text-center bg-white">
                                                <AlertCircle className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                                                <h3 className="text-lg font-bold text-gray-800 mb-2">
                                                    Tidak Ada Produk yang Sesuai
                                                </h3>
                                                <p className="text-muted-foreground">
                                                    Modal {formatRupiah(modalNum)} tidak cukup untuk membeli produk manapun. Coba tambahkan modal.
                                                </p>
                                            </Card>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                        Rekomendasi Produk ({recommended.length} jenis)
                                                    </h3>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setRecommended(null)}
                                                        className="text-gray-500"
                                                    >
                                                        <RotateCcw className="h-4 w-4 mr-1" />
                                                        Hitung Ulang
                                                    </Button>
                                                </div>
                                                {recommended.map((item, idx) => (
                                                    <ProductResultCard key={item.product.id} item={item} index={idx} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        {/* Brand Filter Buttons */}
                                        <div className="mb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Filter className="h-4 w-4 text-gray-400" />
                                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => setFilterBrand("all")}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                                                        filterBrand === "all"
                                                            ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-200 scale-105"
                                                            : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm hover:border-red-200"
                                                    }`}
                                                >
                                                    Semua
                                                </button>
                                                {brands.map((b) => (
                                                    <button
                                                        key={b.id}
                                                        onClick={() => setFilterBrand(b.id)}
                                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                                                            filterBrand === b.id
                                                                ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-200 scale-105"
                                                                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm hover:border-red-200"
                                                        }`}
                                                    >
                                                        {b.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Search & Category Filter */}
                                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <Input
                                                    value={search}
                                                    onChange={(e) => setSearch(e.target.value)}
                                                    placeholder="Cari produk..."
                                                    className="pl-10 rounded-xl"
                                                />
                                            </div>
                                            <select
                                                value={filterCategory}
                                                onChange={(e) => setFilterCategory(e.target.value)}
                                                className="px-4 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                                            >
                                                <option value="all">Semua Kategori</option>
                                                {categories.map((c) => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Product Grid */}
                                        {filteredProducts.length === 0 ? (
                                            <div className="py-16 text-center">
                                                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                                <p className="text-muted-foreground">Tidak ada produk ditemukan</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {filteredProducts.map((product) => {
                                                    const capital = Number(product.capitalPrice);
                                                    const profit = getProfit(product);
                                                    const cartItem = cart.get(product.id);
                                                    const currentQty = cartItem?.qty || 0;
                                                    const disabled = capital > cartSummary.remaining;

                                                    return (
                                                        <Card
                                                            key={product.id}
                                                            className={`p-4 bg-white border transition-all duration-300 ${disabled && currentQty === 0
                                                                ? "opacity-50 border-gray-200"
                                                                : currentQty > 0
                                                                    ? "border-red-300 bg-red-50/30 shadow-md"
                                                                    : "border-gray-100 hover:border-red-200 hover:shadow-md"
                                                                }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="font-bold text-sm text-gray-900 truncate flex items-center gap-1.5">
                                                                        {product.name}
                                                                        {product.isHot && <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500 shrink-0" />}
                                                                    </h4>
                                                                    <div className="flex items-center gap-2 mt-1.5">
                                                                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-gray-100">
                                                                            {product.categoryName}
                                                                        </Badge>
                                                                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700">
                                                                            {product.brandName}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                                                                        <div>Modal: <span className="font-semibold text-gray-700">{formatRupiah(capital)}</span></div>
                                                                        <div>Jual: <span className="font-semibold text-gray-700">{formatRupiah(Number(product.sellingPrice))}</span></div>
                                                                    </div>
                                                                    <div className="mt-1 flex items-center gap-1 text-xs flex-wrap">
                                                                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                                                                        <span className="font-bold text-emerald-600">
                                                                            +{formatRupiah(profit)}
                                                                        </span>
                                                                        <span className="font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                                                            {capital > 0 ? ((profit / capital) * 100).toFixed(1) : 0}%
                                                                        </span>
                                                                        {Number(product.cashback) > 0 && (
                                                                            <span className="text-orange-500 ml-1">(incl. CB {formatRupiah(Number(product.cashback))})</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-center gap-1">
                                                                    {currentQty > 0 ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <button
                                                                                onClick={() => removeFromCart(product.id)}
                                                                                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-600 hover:text-red-600 transition-colors cursor-pointer"
                                                                            >
                                                                                <Minus className="h-4 w-4" />
                                                                            </button>
                                                                            <span className="w-8 text-center font-bold text-sm">{currentQty}</span>
                                                                            <button
                                                                                onClick={() => addToCart(product)}
                                                                                disabled={disabled}
                                                                                className="w-8 h-8 rounded-lg bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                                                            >
                                                                                <Plus className="h-4 w-4" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => addToCart(product)}
                                                                            disabled={disabled}
                                                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                                                        >
                                                                            <Plus className="h-3.5 w-3.5" />
                                                                            Pilih
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right: Summary Sidebar */}
                            <div className="lg:col-span-1">
                                <div className="sticky top-24 space-y-4">
                                    {/* Summary Card */}
                                    <Card className="p-6 bg-white border border-gray-100 shadow-sm">
                                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-5 flex items-center gap-2">
                                            <Coins className="h-4 w-4" />
                                            Ringkasan Simulasi
                                        </h3>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-muted-foreground">Modal Awal</span>
                                                <span className="text-sm font-bold">{formatRupiah(modalNum)}</span>
                                            </div>

                                            {currentSummary && (
                                                <>
                                                    <div className="h-px bg-gray-100" />
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-muted-foreground">Modal Terpakai</span>
                                                        <span className="text-sm font-bold text-orange-600">{formatRupiah(currentSummary.totalCapital)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-muted-foreground">Sisa Modal</span>
                                                        <span className="text-sm font-bold">{formatRupiah(currentSummary.remaining)}</span>
                                                    </div>
                                                    <div className="h-px bg-gray-100" />
                                                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-4 -mx-1">
                                                        <div className="text-xs text-emerald-600 font-semibold mb-1">Total Keuntungan</div>
                                                        <div className="text-2xl font-black text-emerald-600 flex items-center gap-2">
                                                            <TrendingUp className="h-5 w-5" />
                                                            {formatRupiah(currentSummary.totalProfit)}
                                                        </div>
                                                        {currentSummary.totalCapital > 0 && (
                                                            <div className="text-sm font-bold text-emerald-500 mt-1">
                                                                {((currentSummary.totalProfit / currentSummary.totalCapital) * 100).toFixed(1)}% dari modal
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </Card>

                                    {/* Export Button */}
                                    {currentItems && currentItems.length > 0 && currentSummary && (
                                        <Button
                                            onClick={() => exportExcel(currentItems, currentSummary)}
                                            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-2xl py-6 font-bold shadow-lg shadow-emerald-200 transition-all duration-300 hover:scale-[1.02]"
                                        >
                                            <Download className="h-5 w-5 mr-2" />
                                            Export ke Excel
                                        </Button>
                                    )}

                                    <Card className="p-5 bg-gradient-to-br from-emerald-50 to-white border-emerald-100 shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
                                                <MessageCircle className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Cara Daftar</p>
                                                <h4 className="mt-1 text-base font-black text-gray-900">Daftar DigiposAja via admin</h4>
                                                <p className="mt-2 text-sm text-gray-600">
                                                    Untuk pendaftaran DigiposAja, hubungi admin di nomor WhatsApp berikut.
                                                </p>
                                                <p className="mt-2 text-sm font-bold text-emerald-700">{whatsappNumber}</p>
                                                <a
                                                    href={whatsappUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
                                                >
                                                    <MessageCircle className="h-4 w-4" />
                                                    Hubungi Admin
                                                </a>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Info Card */}
                                    <Card className="p-5 bg-gradient-to-br from-red-50 to-orange-50 border-red-100">
                                        <h4 className="font-bold text-sm text-red-800 mb-2">💡 Tips Cuan</h4>
                                        <ul className="text-xs text-red-700/80 space-y-1.5">
                                            <li className="flex gap-2">
                                                <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                Gunakan mode &quot;Rekomendasi&quot; untuk hasil optimal otomatis
                                            </li>
                                            <li className="flex gap-2">
                                                <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                Mode &quot;Pilih Sendiri&quot; untuk kustomisasi sesuai kebutuhan
                                            </li>
                                            <li className="flex gap-2">
                                                <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                Download hasil simulasi ke Excel untuk referensi
                                            </li>
                                        </ul>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}

function ProductResultCard({ item, index }: { item: CartItem; index: number }) {
    const profit = getProfit(item.product) * item.qty;
    const capital = Number(item.product.capitalPrice) * item.qty;
    const profitPct = capital > 0 ? ((profit / capital) * 100).toFixed(1) : "0";

    return (
        <Card className="p-4 bg-white border border-gray-100 hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-gray-900 truncate flex items-center gap-1.5">
                        {item.product.name}
                        {item.product.isHot && <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500 shrink-0" />}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-gray-100">
                            {item.product.categoryName}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700">
                            {item.product.brandName}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>Modal: <span className="font-semibold text-gray-700">{formatRupiah(Number(item.product.capitalPrice))}</span></span>
                        <span>Jual: <span className="font-semibold text-blue-600">{formatRupiah(Number(item.product.sellingPrice))}</span></span>
                        <span>×{item.qty}</span>
                        <span className="font-semibold text-gray-700">= {formatRupiah(capital)}</span>
                    </div>
                    {Number(item.product.cashback) > 0 && (
                        <div className="mt-1 text-xs text-orange-500">
                            Cashback: {formatRupiah(Number(item.product.cashback))}/unit
                        </div>
                    )}
                </div>
                <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">Keuntungan</div>
                    <div className="text-lg font-black text-emerald-600">+{formatRupiah(profit)}</div>
                    <div className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">{profitPct}%</div>
                </div>
            </div>
        </Card>
    );
}
