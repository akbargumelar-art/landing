"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, RefreshCw, ShoppingCart, Terminal } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface RedemptionLog {
    id: string;
    voucherId: string;
    status: "sukses" | "gagal";
    responseMessage: string;
    createdAt: string;
}

interface Order {
    id: string;
    customerPhone: string;
    paymentStatus: "pending" | "success" | "failed";
    totalPrice: string | number;
    lynkIdUrl: string;
    lynkIdTrx: string | null;
    createdAt: string;
    productId: string;
    productName: string;
    productType: "fisik" | "virtual" | "jasa";
    redemptionLog: RedemptionLog | null;
}

interface Meta {
    totalCount: number;
    limit: number;
    offset: number;
}

export default function PesananPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>("");

    const [selectedLog, setSelectedLog] = useState<RedemptionLog | null>(null);
    const [logDialogOpen, setLogDialogOpen] = useState(false);

    const fetchOrders = () => {
        setLoading(true);
        fetch("/api/admin/orders?limit=100")
            .then((r) => r.json())
            .then((data) => {
                if (data.data) {
                    setOrders(data.data);
                    setMeta(data.meta);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const viewLog = (log: RedemptionLog) => {
        setSelectedLog(log);
        setLogDialogOpen(true);
    };

    const formatRupiah = (val: string | number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(val));
    };

    const filtered = filterStatus
        ? orders.filter(o => o.paymentStatus === filterStatus)
        : orders;

    if (loading && orders.length === 0) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="max-w-6xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Riwayat Pesanan</h2>
                    <p className="text-sm text-muted-foreground">Monitor transaksi belanja dan hasil redeem voucher otomatis.</p>
                </div>
                <Button onClick={fetchOrders} variant="outline" className="cursor-pointer bg-white">
                    <RefreshCw className="h-4 w-4 mr-2" /> Segarkan Data
                </Button>
            </div>

            <div className="flex gap-2">
                <button onClick={() => setFilterStatus("")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${!filterStatus ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Semua ({meta?.totalCount || 0})</button>
                <button onClick={() => setFilterStatus("success")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${filterStatus === "success" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Berhasil (Sukses)</button>
                <button onClick={() => setFilterStatus("pending")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${filterStatus === "pending" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Menunggu Pembayaran</button>
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    {filtered.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-muted-foreground space-y-2">
                            <ShoppingCart className="h-10 w-10 opacity-20" />
                            <p className="text-sm">Tidak ada transaksi ditemukan.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground bg-gray-50/50 border-b">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Order ID / Waktu</th>
                                    <th className="px-6 py-4 font-medium">Pelanggan</th>
                                    <th className="px-6 py-4 font-medium">Produk</th>
                                    <th className="px-6 py-4 font-medium">Total Harga</th>
                                    <th className="px-6 py-4 font-medium">Status Bayar</th>
                                    <th className="px-6 py-4 font-medium">Voucher Log</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.map((order) => (
                                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-mono text-xs">{order.id.slice(0, 13)}...</div>
                                            <div className="text-[10px] text-muted-foreground mt-1">
                                                {new Date(order.createdAt).toLocaleString("id-ID")}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium whitespace-nowrap font-mono">{order.customerPhone}</div>
                                            <div className="text-[10px] text-muted-foreground mt-1 cursor-pointer hover:underline text-blue-600" onClick={() => window.open(`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`, '_blank')}>
                                                Hubungi WA
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium line-clamp-1">{order.productName || "Produk Terhapus"}</div>
                                            <Badge variant="outline" className={`mt-1 text-[10px] ${order.productType === 'virtual' ? 'text-blue-600 border-blue-200 bg-blue-50' : ''}`}>
                                                {order.productType.toUpperCase()}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-emerald-600 whitespace-nowrap">
                                            {formatRupiah(order.totalPrice)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge variant={order.paymentStatus === 'success' ? 'default' : order.paymentStatus === 'failed' ? 'destructive' : 'secondary'} className={order.paymentStatus === 'success' ? 'bg-green-600' : ''}>
                                                {order.paymentStatus.toUpperCase()}
                                            </Badge>
                                            {order.lynkIdUrl && order.paymentStatus === 'pending' && (
                                                <a href={order.lynkIdUrl} target="_blank" className="block text-[10px] text-blue-500 hover:underline mt-1 mt-1 flex items-center">
                                                    Lihat Link Bayar <ExternalLink className="h-2 w-2 ml-1" />
                                                </a>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {order.productType !== 'virtual' ? (
                                                <span className="text-[10px] text-muted-foreground">- (Bukan Virtual)</span>
                                            ) : order.redemptionLog ? (
                                                <Button
                                                    size="sm"
                                                    variant={order.redemptionLog.status === 'sukses' ? 'outline' : 'destructive'}
                                                    className={`h-7 px-2 text-[10px] cursor-pointer ${order.redemptionLog.status === 'sukses' ? 'text-green-600 border-green-200 hover:bg-green-50' : ''}`}
                                                    onClick={() => viewLog(order.redemptionLog!)}
                                                >
                                                    <Terminal className="h-3 w-3 mr-1" />
                                                    {order.redemptionLog.status === 'sukses' ? 'LOG SUKSES' : 'LOG GAGAL'}
                                                </Button>
                                            ) : order.paymentStatus === 'success' ? (
                                                <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-200">Menunggu Bot...</Badge>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground">Menunggu Lunas</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Detail Log Bukti Auto-Redeem</DialogTitle>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-muted-foreground text-xs mb-1">Status Web Telkomsel</span>
                                    <Badge variant={selectedLog.status === 'sukses' ? 'default' : 'destructive'} className={selectedLog.status === 'sukses' ? 'bg-green-600' : ''}>
                                        {selectedLog.status.toUpperCase()}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="block text-muted-foreground text-xs mb-1">Waktu Eksekusi</span>
                                    <span className="font-medium">{new Date(selectedLog.createdAt).toLocaleString("id-ID")}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <span className="block text-muted-foreground text-xs">Pesan Respons JSON Server/Bot</span>
                                <div className="p-3 bg-black rounded-lg border border-gray-800 text-green-400 font-mono text-xs overflow-x-auto">
                                    <pre>{selectedLog.responseMessage}</pre>
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Jika status Gagal karena masalah Telkomsel atau salah nomor HP dari pelanggan, silakan hubungi pelanggan via WhatsApp dengan menekan tombol (Hubungi WA) pada baris pesanan, lalu berikan kode pengganti secara manual.</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setLogDialogOpen(false)} className="cursor-pointer">Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
