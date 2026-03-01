"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ShoppingBag, Store, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";

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

export default function BelanjaKatalogPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState<string>("all");

    useEffect(() => {
        // We can reuse the admin API here if we don't have a public one yet, but ideally we make a public one.
        // For now, fetch from /api/admin/products and filter active ones Client-side,
        // (to save time, but a /api/public/products is better). Let's fetch the admin one for now.
        fetch("/api/admin/products")
            .then((r) => r.json())
            .then((data: Product[]) => {
                setProducts(data.filter(p => p.isActive));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const formatRupiah = (val: string | number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(val));
    };

    const filtered = products.filter(p => {
        const matchesCategory = filterType === "all" || p.type === filterType;
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header / Hero Section */}
            <div className="bg-gradient-to-r from-red-600 to-red-800 py-16 text-white text-center">
                <div className="max-w-4xl mx-auto px-4">
                    <h1 className="text-4xl lg:text-5xl font-extrabold mb-4 tracking-tight">Mall Khusus Pelanggan</h1>
                    <p className="text-lg text-red-100 mb-8 max-w-2xl mx-auto">
                        Beli voucher internet otomatis masuk, barang fisik dengan pengiriman, dan layanan jasa instalasi kami dengan mudah menggunakan Lynk.id.
                    </p>

                    {/* Search Bar */}
                    <div className="relative max-w-xl mx-auto">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari voucher Telkomsel, modem, dll..."
                            className="w-full pl-12 pr-4 py-6 rounded-full text-black shadow-lg"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
                {/* Filters */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
                    <button onClick={() => setFilterType("all")} className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${filterType === "all" ? "bg-red-600 text-white scale-105" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}>
                        <Store className="h-4 w-4" /> Semua Produk
                    </button>
                    <button onClick={() => setFilterType("virtual")} className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${filterType === "virtual" ? "bg-blue-600 text-white scale-105" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}>
                        <Tag className="h-4 w-4" /> Voucher Virtual (Auto)
                    </button>
                    <button onClick={() => setFilterType("fisik")} className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${filterType === "fisik" ? "bg-emerald-600 text-white scale-105" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}>
                        <ShoppingBag className="h-4 w-4" /> Barang Fisik
                    </button>
                    <button onClick={() => setFilterType("jasa")} className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${filterType === "jasa" ? "bg-orange-600 text-white scale-105" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"}`}>
                        Layanan Jasa
                    </button>
                </div>

                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-red-600" />
                        <p className="text-muted-foreground font-medium">Memuat katalog...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-24 text-center">
                        <Store className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-700">Tidak ada produk ditemukan</h3>
                        <p className="text-gray-500 mt-2">Coba ubah kata kunci pencarian atau kategori.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
                        {filtered.map(product => (
                            <Link key={product.id} href={`/belanja/${product.id}`} className="group h-full">
                                <Card className="h-full overflow-hidden hover:shadow-xl transition-all duration-300 border border-border group-hover:-translate-y-1 bg-white">
                                    {/* Image */}
                                    <div className="relative aspect-square w-full bg-gray-100 overflow-hidden">
                                        {product.imageUrl ? (
                                            <Image
                                                src={product.imageUrl}
                                                alt={product.name}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                unoptimized={true}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                                <span className="text-white text-4xl font-black opacity-50">{product.name.charAt(0)}</span>
                                            </div>
                                        )}
                                        {/* Badges */}
                                        <div className="absolute top-3 left-3 flex flex-col gap-2">
                                            <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm shadow-sm text-xs font-bold border-0">
                                                {product.type === "virtual" ? "🛒 VOUCHER AUTO" : product.type === "fisik" ? "📦 BARANG FISIK" : "🔧 JASA"}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-5 flex flex-col h-[calc(100%-100%)]">
                                        <h3 className="font-bold text-lg text-foreground line-clamp-2 leading-tight mb-2 group-hover:text-red-700 transition-colors">
                                            {product.name}
                                        </h3>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-1">
                                            {product.description}
                                        </p>

                                        <div className="flex items-end justify-between mt-auto">
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-0.5">Stok: {product.stock > 0 ? product.stock : <span className="text-red-500">Habis</span>}</p>
                                                <p className="text-xl font-black text-red-600 leading-none">{formatRupiah(product.price)}</p>
                                            </div>
                                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4" disabled={product.stock <= 0}>
                                                Beli
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
