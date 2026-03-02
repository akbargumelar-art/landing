"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ChevronLeft, ChevronRight, ExternalLink, ArrowRight } from "lucide-react";

interface ShopBanner {
    id: string;
    title: string;
    imageUrl: string;
    link: string;
}

interface ShopSection {
    id: string;
    type: "banner" | "product_carousel" | "service_grid" | "cta_cards";
    title: string;
    subtitle: string;
    config: string;
}

interface Product {
    id: string;
    name: string;
    type: "fisik" | "virtual" | "jasa";
    description: string;
    imageUrl: string;
    price: string | number;
    stock: number;
    shopeeUrl: string;
    tokopediaUrl: string;
}

// ── Hero Banner Carousel ────────────────────────────────────────────
function HeroBannerCarousel({ banners }: { banners: ShopBanner[] }) {
    const [current, setCurrent] = useState(0);
    const next = useCallback(() => setCurrent((p) => (p + 1) % banners.length), [banners.length]);
    const prev = () => setCurrent((p) => (p - 1 + banners.length) % banners.length);

    useEffect(() => {
        if (banners.length <= 1) return;
        const t = setInterval(next, 5000);
        return () => clearInterval(t);
    }, [next, banners.length]);

    if (banners.length === 0) return null;

    return (
        <div className="relative w-full overflow-hidden rounded-2xl md:rounded-3xl shadow-xl">
            <div className="relative h-[200px] sm:h-[280px] md:h-[380px] lg:h-[420px]">
                {banners.map((b, i) => (
                    <a key={b.id} href={b.link || "#"} className={`absolute inset-0 transition-all duration-700 ease-in-out ${i === current ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}>
                        <Image src={b.imageUrl} alt={b.title} fill className="object-cover" unoptimized priority={i === 0} />
                        {b.title && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 md:p-8">
                                <h2 className="text-white font-extrabold text-lg md:text-2xl drop-shadow-lg">{b.title}</h2>
                            </div>
                        )}
                    </a>
                ))}
            </div>
            {banners.length > 1 && (
                <>
                    <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-colors cursor-pointer z-10">
                        <ChevronLeft className="h-5 w-5 text-gray-700" />
                    </button>
                    <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-colors cursor-pointer z-10">
                        <ChevronRight className="h-5 w-5 text-gray-700" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                        {banners.map((_, i) => (
                            <button key={i} onClick={() => setCurrent(i)} className={`h-2 rounded-full transition-all cursor-pointer ${i === current ? "w-8 bg-red-600" : "w-2 bg-white/60"}`} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ── Product Carousel ────────────────────────────────────────────────
function ProductCarousel({ title, subtitle, products, filterType }: { title: string; subtitle: string; products: Product[]; filterType?: string }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const filtered = filterType && filterType !== "all" ? products.filter(p => p.type === filterType) : products;
    const formatRupiah = (val: string | number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(val));

    if (filtered.length === 0) return null;

    const scroll = (dir: number) => {
        scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
    };

    return (
        <div>
            <div className="flex items-end justify-between mb-5">
                <div>
                    <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">{title}</h2>
                    {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                </div>
                <Link href="/belanja" className="text-red-600 text-sm font-semibold hover:underline flex items-center gap-1">
                    Lihat Semua <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
            <div className="relative group">
                <button onClick={() => scroll(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 rounded-full bg-white shadow-lg border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer hover:bg-gray-50">
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <div ref={scrollRef} className="flex gap-4 overflow-x-auto scroll-smooth pb-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                    {filtered.map(product => (
                        <Link key={product.id} href={`/belanja/${product.id}`} className="shrink-0 w-[200px] md:w-[220px] group/card">
                            <Card className="overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white h-full">
                                <div className="relative aspect-square bg-gray-50 overflow-hidden">
                                    {product.imageUrl ? (
                                        <Image src={product.imageUrl} alt={product.name} fill className="object-cover group-hover/card:scale-105 transition-transform duration-500" unoptimized />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center">
                                            <span className="text-4xl font-black text-red-300">{product.name.charAt(0)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3">
                                    <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1 leading-snug">{product.name}</h3>
                                    <p className="text-red-600 font-extrabold text-base">{formatRupiah(product.price)}</p>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
                <button onClick={() => scroll(1)} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 rounded-full bg-white shadow-lg border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer hover:bg-gray-50">
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

// ── Service Grid ────────────────────────────────────────────────────
function ServiceGrid({ title, items }: { title: string; items: { icon: string; label: string; link: string }[] }) {
    if (items.length === 0) return null;
    return (
        <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 mb-5">{title}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {items.map((item, i) => (
                    <a key={i} href={item.link || "#"} target={item.link?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="group">
                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-center flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                <span className="text-2xl">{item.icon}</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-700 leading-tight">{item.label}</span>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}

// ── CTA Cards ───────────────────────────────────────────────────────
function CTACards({ title, items }: { title: string; items: { icon: string; label: string; subtitle: string; link: string }[] }) {
    if (items.length === 0) return null;
    return (
        <div>
            {title && <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 mb-5">{title}</h2>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item, i) => (
                    <a key={i} href={item.link || "#"} target={item.link?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex items-center gap-4 cursor-pointer group">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <span className="text-2xl">{item.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-900 text-sm">{item.label}</h3>
                                {item.subtitle && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.subtitle}</p>}
                            </div>
                            <ExternalLink className="h-4 w-4 text-gray-300 shrink-0 group-hover:text-red-500 transition-colors" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function ShopPage() {
    const [banners, setBanners] = useState<ShopBanner[]>([]);
    const [sections, setSections] = useState<ShopSection[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/public/shop")
            .then(r => r.json())
            .then(data => {
                setBanners(data.banners || []);
                setSections(data.sections || []);
                setProducts(data.products || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-red-600" />
                    <p className="text-sm text-gray-500 font-medium">Memuat TShop...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 pt-4 pb-8 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                                <span className="text-red-600 font-extrabold text-sm">T</span>
                            </div>
                            <span className="text-white font-extrabold text-xl tracking-tight">Shop</span>
                        </div>
                        <Link href="/belanja">
                            <Button variant="ghost" className="text-white hover:bg-white/10 text-sm font-semibold cursor-pointer">
                                Katalog Lengkap <ArrowRight className="ml-1 h-4 w-4" />
                            </Button>
                        </Link>
                    </div>

                    {/* Hero Banners */}
                    <HeroBannerCarousel banners={banners} />
                </div>
            </div>

            {/* Content Sections */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
                {sections.map(section => {
                    let config: Record<string, unknown> = {};
                    try { config = JSON.parse(section.config); } catch { /* ignore */ }

                    switch (section.type) {
                        case "product_carousel":
                            return (
                                <ProductCarousel
                                    key={section.id}
                                    title={section.title}
                                    subtitle={section.subtitle}
                                    products={products}
                                    filterType={config.filterType as string}
                                />
                            );
                        case "service_grid":
                            return (
                                <ServiceGrid
                                    key={section.id}
                                    title={section.title}
                                    items={(config.items as { icon: string; label: string; link: string }[]) || []}
                                />
                            );
                        case "cta_cards":
                            return (
                                <CTACards
                                    key={section.id}
                                    title={section.title}
                                    items={(config.items as { icon: string; label: string; subtitle: string; link: string }[]) || []}
                                />
                            );
                        default:
                            return null;
                    }
                })}

                {/* Fallback if no sections configured yet */}
                {sections.length === 0 && products.length > 0 && (
                    <>
                        <ProductCarousel title="Semua Produk" subtitle="Produk pilihan untuk Anda" products={products} />
                        <ProductCarousel title="Voucher Internet" subtitle="Voucher internet otomatis masuk" products={products} filterType="virtual" />
                        <ProductCarousel title="Produk Fisik" subtitle="Dikirim langsung ke alamat Anda" products={products} filterType="fisik" />
                    </>
                )}

                {/* Empty state */}
                {sections.length === 0 && products.length === 0 && banners.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🛒</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-700 mb-2">Shop Sedang Disiapkan</h2>
                        <p className="text-gray-500 mb-6">Halaman ini sedang dikonfigurasi oleh admin.</p>
                        <Link href="/belanja">
                            <Button className="bg-red-600 hover:bg-red-700 text-white cursor-pointer">
                                Kunjungi Katalog Belanja
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
