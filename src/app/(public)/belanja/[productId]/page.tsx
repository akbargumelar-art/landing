"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, ShieldCheck, Tag, ShoppingBag, Truck, Smartphone } from "lucide-react";
import Link from "next/link";

interface Product {
    id: string;
    name: string;
    type: "fisik" | "virtual" | "jasa";
    description: string;
    imageUrl: string;
    price: string | number;
    stock: number;
}

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params?.productId as string;

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [phone, setPhone] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!productId) return;
        fetch(`/api/public/products/${productId}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.id) setProduct(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [productId]);

    const formatRupiah = (val: string | number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(val));
    };

    const handleBuy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone) {
            alert("Harap masukkan nomor HP (WhatsApp / Telkomsel).");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/public/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId, customerPhone: phone }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                // Redirect user to payment tracking page
                router.push(`/checkout/${data.orderId}`);
            } else {
                alert(data.error || "Gagal membuat pesanan.");
                setSubmitting(false);
            }
        } catch (error) {
            alert("Terjadi kesalahan jaringan.");
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-10 w-10 animate-spin text-red-600" /></div>;
    }

    if (!product) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <h1 className="text-2xl font-bold text-gray-800">Barang tidak ditemukan.</h1>
                <Link href="/belanja" className="text-red-600 hover:underline mt-4 cursor-pointer">&larr; Kembali ke Katalog</Link>
            </div>
        );
    }

    const isVirtual = product.type === "virtual";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pt-8 pb-16">
            <div className="max-w-5xl mx-auto w-full px-4 flex-1">
                <Link href="/belanja" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-red-600 transition-colors mb-6 cursor-pointer">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Katalog
                </Link>

                <div className="bg-white rounded-3xl shadow-lg border overflow-hidden flex flex-col md:flex-row">
                    {/* Left: Image */}
                    <div className="md:w-1/2 bg-gray-100 flex items-center justify-center p-8 relative min-h-[300px] md:min-h-full">
                        {product.imageUrl ? (
                            <div className="relative w-full aspect-square max-w-sm rounded-2xl overflow-hidden shadow-2xl">
                                <Image src={product.imageUrl} alt={product.name} fill className="object-cover" unoptimized={true} />
                            </div>
                        ) : (
                            <div className="w-full aspect-square max-w-sm bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
                                <span className="text-white text-8xl font-black opacity-30">{product.name.charAt(0)}</span>
                            </div>
                        )}
                        <Badge variant="secondary" className="absolute top-6 left-6 text-sm py-1.5 px-4 bg-white/90 backdrop-blur-sm shadow-md border-0 font-bold uppercase tracking-wider">
                            {isVirtual ? "Virtual Auto" : product.type === "fisik" ? "Barang Fisik" : "Layanan Jasa"}
                        </Badge>
                    </div>

                    {/* Right: Info and Form */}
                    <div className="md:w-1/2 p-8 lg:p-12 flex flex-col justify-center">
                        <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight mb-4">{product.name}</h1>
                        <p className="text-3xl font-black text-red-600 mb-6">{formatRupiah(product.price)}</p>

                        <div className="space-y-4 mb-8">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                                <p className="text-sm text-gray-600">Pembayaran terverifikasi aman melalui platform <span className="font-bold">Lynk.id</span>.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                {isVirtual ? <Smartphone className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" /> : <Truck className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />}
                                <p className="text-sm text-gray-600">
                                    {isVirtual
                                        ? "Kode voucher akan otomatis diinject / dikirim ke nomor HP kamu setelah pembayaran berhasil."
                                        : "Tuliskan nomor WhatsApp aktif agar kurir / teknisi kami bisa menghubungi untuk pengiriman."}
                                </p>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-5 mb-8 border">
                            <h3 className="text-sm font-bold text-gray-900 mb-2">Deskripsi Produk</h3>
                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description || "Tidak ada deskripsi detail."}</p>
                            <p className="text-sm font-semibold mt-4 text-gray-800">Sisa Stok: {product.stock > 0 ? product.stock : <span className="text-red-600 underline">Habis Terjual</span>}</p>
                        </div>

                        {/* Order Form */}
                        <form onSubmit={handleBuy} className="mt-auto">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-800 flex items-center">
                                        Nomor {isVirtual ? "Telkomsel (Paket Data)" : "WhatsApp (Dihubungi Kurir)"} <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <Input
                                        type="tel"
                                        required
                                        placeholder={isVirtual ? "Contoh: 08123456789 (Pastikan Aktif)" : "Contoh: 08123456789"}
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="h-12 bg-gray-50 border-gray-300 rounded-xl px-4 text-lg focus-visible:ring-red-600"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={submitting || product.stock <= 0}
                                    className="w-full h-14 text-base font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShoppingBag className="h-5 w-5 mr-2" />}
                                    {product.stock <= 0 ? "STOK HABIS" : "Lanjutkan Pembayaran"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
