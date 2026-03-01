"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, UploadCloud, Ticket } from "lucide-react";
import * as XLSX from "xlsx";

interface Product {
    id: string;
    name: string;
    type: "fisik" | "virtual" | "jasa";
    stock: number;
}

interface Voucher {
    id: string;
    code: string;
    isUsed: boolean;
    productName: string;
    createdAt: string;
    usedAt: string | null;
}

export default function VoucherPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Fetch only virtual products
        fetch("/api/admin/products")
            .then((r) => r.json())
            .then((data: Product[]) => {
                const virtuals = data.filter(p => p.type === "virtual");
                setProducts(virtuals);
                if (virtuals.length > 0) {
                    setSelectedProduct(virtuals[0].id);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const fetchVouchers = (productId: string) => {
        setLoading(true);
        fetch(`/api/admin/vouchers?productId=${productId}`)
            .then((r) => r.json())
            .then((data) => {
                setVouchers(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        if (selectedProduct) {
            fetchVouchers(selectedProduct);
        }
    }, [selectedProduct]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedProduct) return;

        setUploading(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

                // Assume codes are in the first column
                const codes = data.map(row => row[0]).filter(Boolean).map(String).map(s => s.trim());

                if (codes.length === 0) {
                    alert("Tidak ada kode voucher ditemukan di Kolom A.");
                    setUploading(false);
                    return;
                }

                if (!confirm(`Konfirmasi penambahan ${codes.length} voucher ke produk ini?`)) {
                    setUploading(false);
                    return;
                }

                const res = await fetch("/api/admin/vouchers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productId: selectedProduct, codes }),
                });

                const result = await res.json();
                if (result.success) {
                    alert(`Berhasil mengunggah ${result.inserted} kode voucher.`);
                    fetchVouchers(selectedProduct);
                    // refresh product selection to show updated stock
                    setProducts(products.map(p => p.id === selectedProduct ? { ...p, stock: p.stock + result.inserted } : p));
                } else {
                    alert(result.error || "Gagal upload voucher");
                }
            } catch {
                alert("Terjadi kesalahan membaca file CSV/Excel.");
            }
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        };
        reader.readAsBinaryString(file);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus kode voucher ini secara permanen?")) return;
        await fetch(`/api/admin/vouchers/${id}`, { method: "DELETE" });
        setVouchers((prev) => prev.filter((v) => v.id !== id));
        setProducts(products.map(p => p.id === selectedProduct ? { ...p, stock: Math.max(0, p.stock - 1) } : p));
    };

    if (loading && products.length === 0) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Stok Kode Voucher</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left col - Selection & Upload */}
                <div className="md:col-span-1 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Pilih Produk Virtual</label>
                        <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                        >
                            {products.length === 0 && <option value="">(Belum / Tidak ada Produk Virtual)</option>}
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock})</option>
                            ))}
                        </select>
                    </div>

                    <Card className="bg-red-50 border-red-100">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="font-semibold text-red-900 text-sm">Upload Massal</h3>
                            <p className="text-xs text-red-800">
                                Unggah file Excel (<strong>.xlsx</strong>) atau <strong>.csv</strong>. Sistem hanya membaca <strong>Kolom A</strong> baris berapapun.
                            </p>

                            <input
                                type="file"
                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                className="hidden"
                                ref={fileRef}
                                onChange={handleFileUpload}
                            />

                            <Button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading || !selectedProduct}
                                className="w-full bg-white text-red-600 hover:bg-gray-100 border border-red-200 cursor-pointer"
                            >
                                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                                Pilih File CSV / XLSX
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Right col - List of Vouchers */}
                <div className="md:col-span-2">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-sm">Daftar Kode Terakhir (Max 500)</h3>
                                <Badge variant="secondary" className="text-xs">{vouchers.length} dimuat</Badge>
                            </div>

                            {loading ? (
                                <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                            ) : vouchers.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-2">
                                    <Ticket className="h-8 w-8 opacity-20" />
                                    <p className="text-sm">Tidak ada voucher terkait produk ini.</p>
                                </div>
                            ) : (
                                <div className="max-h-[60vh] overflow-y-auto border rounded-xl divide-y">
                                    {vouchers.map(v => (
                                        <div key={v.id} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                            <div>
                                                <p className="font-mono text-sm font-semibold tracking-wider">{v.code}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant={v.isUsed ? "secondary" : "default"} className={`text-[10px] uppercase font-bold ${!v.isUsed && "bg-green-600"}`}>
                                                        {v.isUsed ? "Terpakai" : "Ready"}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(v.createdAt).toLocaleDateString("id-ID")}
                                                    </span>
                                                </div>
                                            </div>
                                            {!v.isUsed && (
                                                <button onClick={() => handleDelete(v.id)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg cursor-pointer">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
