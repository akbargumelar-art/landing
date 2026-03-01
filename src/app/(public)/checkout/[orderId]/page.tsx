"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Clock, Search, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Product {
    name: string;
    type: "fisik" | "virtual" | "jasa";
}

interface Order {
    id: string;
    customerPhone: string;
    paymentStatus: "pending" | "success" | "failed";
    totalPrice: string | number;
    lynkIdUrl: string;
    createdAt: string;
    product: Product | null;
}

export default function CheckoutTrackingPage() {
    const params = useParams();
    const orderId = params?.orderId as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [simulating, setSimulating] = useState(false);

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/public/orders/track/${orderId}`);
            if (res.ok) {
                const data = await res.json();
                setOrder(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!orderId) return;
        fetchOrder();

        // Auto-refresh every 5 seconds if pending
        const interval = setInterval(() => {
            if (order?.paymentStatus === "pending") {
                fetchOrder();
            }
        }, 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId, order?.paymentStatus]);

    const handleSimulatePayment = async () => {
        setSimulating(true);
        try {
            await fetch(`/api/public/orders/${orderId}/simulate`, { method: "POST" });
            fetchOrder();
        } catch {
            alert("Gagal iterasi test payment");
        }
        setSimulating(false);
    };

    if (loading && !order) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-10 w-10 animate-spin text-red-600" /></div>;
    }

    if (!order && !loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <Search className="h-16 w-16 text-gray-300 mb-4" />
                <h1 className="text-2xl font-bold text-gray-800">Pesanan tidak ditemukan</h1>
                <p className="text-gray-500 mt-2 mb-6">Pastikan ID Tracker atau URL yang Anda tuju dengan benar.</p>
                <Link href="/belanja" className="text-red-600 font-medium hover:underline cursor-pointer">Katalog Belanja Kami &rarr;</Link>
            </div>
        );
    }

    if (!order) return null; // Fallback

    const formatRupiah = (val: string | number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(val));
    };

    const isVirtual = order.product?.type === "virtual";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 py-12">
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Status Pesanan</h1>
                    <p className="text-sm font-mono text-gray-500 mt-2 cursor-pointer hover:text-gray-800 transition" onClick={() => navigator.clipboard.writeText(order.id)}>Track ID: {order.id}</p>
                </div>

                <Card className="shadow-2xl border-0 overflow-hidden rounded-3xl">
                    <div className={`h-3 w-full ${order.paymentStatus === 'success' ? 'bg-green-500' : order.paymentStatus === 'pending' ? 'bg-amber-400' : 'bg-red-500'}`} />
                    <CardContent className="p-8">
                        {/* Status Heading */}
                        <div className="flex flex-col items-center justify-center text-center space-y-4 mb-8">
                            {order.paymentStatus === 'pending' ? (
                                <>
                                    <div className="h-20 w-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-2">
                                        <Clock className="h-10 w-10" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">Menunggu Pembayaran</h2>
                                        <p className="text-gray-500 text-sm mt-1">Silakan selesaikan pembayaran agar pesanan diproses.</p>
                                    </div>
                                </>
                            ) : order.paymentStatus === 'success' ? (
                                <>
                                    <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                        <CheckCircle2 className="h-10 w-10" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">Pembayaran Berhasil!</h2>
                                        {isVirtual ? (
                                            <p className="text-gray-500 text-sm mt-1 font-medium bg-blue-50 text-blue-800 px-3 py-2 rounded-lg mt-3 border border-blue-200">
                                                Bot kami sedang memproses inject voucher ke nomor HP Anda. Harap tunggu 1-5 menit.
                                            </p>
                                        ) : (
                                            <p className="text-gray-500 text-sm mt-1">Pesanan Anda segera dikemas / admin akan menghubungi nomor WA Anda ({order.customerPhone}).</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="h-20 w-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
                                        <XCircle className="h-10 w-10" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">Pembayaran Gagal / Dibatalkan</h2>
                                        <p className="text-gray-500 text-sm mt-1">Silakan ulangi pesanan kembali dari Katalog.</p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Order Details box */}
                        <div className="bg-gray-50 border rounded-2xl p-5 mb-8">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">Rincian Barang</h3>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">{order.product?.name || "Produk Terhapus"}</span>
                                <span className="text-sm font-bold text-gray-900">{formatRupiah(order.totalPrice)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-xs text-gray-500">Penerima (HP)</span>
                                <span className="text-sm font-mono font-medium text-gray-800">{order.customerPhone}</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3">
                            {order.paymentStatus === 'pending' && (
                                <Button
                                    className="w-full text-base font-bold h-14 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg cursor-pointer flex items-center justify-center"
                                    onClick={() => window.open(order.lynkIdUrl, '_blank')}
                                >
                                    Bayar Sekarang via Lynk.id <ExternalLink className="h-4 w-4 ml-2" />
                                </Button>
                            )}

                            <Link href="/belanja" className="w-full">
                                <Button variant="outline" className="w-full h-12 text-gray-600 font-medium cursor-pointer">
                                    <ArrowRight className="h-4 w-4 mr-2" /> Menuju Beranda Belanja
                                </Button>
                            </Link>
                        </div>

                        {/* Simulation Tool (Development Only) */}
                        {order.paymentStatus === 'pending' && (
                            <div className="mt-8 pt-6 border-t border-dashed text-center">
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">🛠️ Development Tools</p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleSimulatePayment}
                                    disabled={simulating}
                                    className="text-xs w-full bg-slate-800 text-white hover:bg-slate-700 cursor-pointer h-10"
                                >
                                    {simulating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    [DEV] Bypas Pembayaran (Simulasikan Lunas)
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <p className="text-xs text-center text-gray-400 mt-6">
                    Simpan tautan halaman ini untuk terus memantau status pesanan kapan saja.
                </p>
            </div>
        </div>
    );
}
