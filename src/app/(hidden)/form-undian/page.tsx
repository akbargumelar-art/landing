"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle, Loader2, X } from "lucide-react";

interface OutletOption {
    id: string;
    name: string;
    city: string;
}

export default function FormUndianPage() {
    const [formData, setFormData] = useState({
        nama: "",
        nomor: "",
        outlet: "",
    });
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [outlets, setOutlets] = useState<OutletOption[]>([]);

    // Fetch outlets from database
    useEffect(() => {
        fetch("/api/public/outlets")
            .then((r) => r.json())
            .then((data) => setOutlets(data))
            .catch(() => { });
    }, []);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.nama.trim()) newErrors.nama = "Nama lengkap wajib diisi";
        if (!formData.nomor.trim()) {
            newErrors.nomor = "Nomor Telkomsel wajib diisi";
        } else if (!formData.nomor.startsWith("08")) {
            newErrors.nomor = "Nomor harus diawali dengan 08";
        } else if (formData.nomor.length < 10 || formData.nomor.length > 13) {
            newErrors.nomor = "Nomor harus 10-13 digit";
        }
        if (!formData.outlet.trim())
            newErrors.outlet = "Nama mitra outlet wajib diisi";
        if (!file) newErrors.file = "Bukti pembelian wajib diupload";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        // Simulate API call
        await new Promise((r) => setTimeout(r, 2000));
        setIsSubmitting(false);
        setIsSuccess(true);
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-0 shadow-2xl">
                    <CardContent className="p-8 text-center">
                        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 animate-bounce">
                            <CheckCircle className="h-10 w-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            Terima Kasih! 🎉
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            Data Anda telah berhasil dikirim. Kami akan memproses pendaftaran
                            undian Anda. Semoga beruntung!
                        </p>
                        <Button
                            onClick={() => {
                                setIsSuccess(false);
                                setFormData({ nama: "", nomor: "", outlet: "" });
                                setFile(null);
                            }}
                            variant="outline"
                            className="w-full"
                        >
                            Daftar Lagi
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                        <span className="text-white font-bold text-xl">A</span>
                    </div>
                    <h1 className="text-xl font-bold text-foreground">ABK Ciraya</h1>
                    <p className="text-sm text-muted-foreground">
                        Formulir Pendaftaran Undian
                    </p>
                </div>

                <Card className="border-0 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-lg">Isi Data Anda</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Nama */}
                            <div className="space-y-2">
                                <Label htmlFor="nama">Nama Lengkap</Label>
                                <Input
                                    id="nama"
                                    placeholder="Masukkan nama lengkap"
                                    value={formData.nama}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, nama: e.target.value }))
                                    }
                                    className={errors.nama ? "border-red-500" : ""}
                                />
                                {errors.nama && (
                                    <p className="text-xs text-red-500">{errors.nama}</p>
                                )}
                            </div>

                            {/* Nomor */}
                            <div className="space-y-2">
                                <Label htmlFor="nomor">Nomor Telkomsel</Label>
                                <Input
                                    id="nomor"
                                    type="tel"
                                    placeholder="08xxxxxxxxxx"
                                    value={formData.nomor}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "");
                                        setFormData((prev) => ({ ...prev, nomor: val }));
                                    }}
                                    className={errors.nomor ? "border-red-500" : ""}
                                />
                                {errors.nomor && (
                                    <p className="text-xs text-red-500">{errors.nomor}</p>
                                )}
                            </div>

                            {/* Outlet */}
                            <div className="space-y-2">
                                <Label htmlFor="outlet">Nama Mitra Outlet</Label>
                                <select
                                    id="outlet"
                                    value={formData.outlet}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, outlet: e.target.value }))
                                    }
                                    className={`flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors duration-200 ${errors.outlet ? "border-red-500" : "border-input"
                                        }`}
                                >
                                    <option value="">Pilih outlet...</option>
                                    {outlets.map((outlet) => (
                                        <option key={outlet.id} value={outlet.name}>
                                            {outlet.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.outlet && (
                                    <p className="text-xs text-red-500">{errors.outlet}</p>
                                )}
                            </div>

                            {/* File Upload */}
                            <div className="space-y-2">
                                <Label>Bukti Pembelian</Label>
                                <div
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-all duration-200 ${dragActive
                                        ? "border-primary bg-primary/5"
                                        : errors.file
                                            ? "border-red-300 bg-red-50"
                                            : "border-border hover:border-primary/50"
                                        }`}
                                >
                                    {file ? (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                                <span className="text-sm text-foreground truncate max-w-[200px]">
                                                    {file.name}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setFile(null)}
                                                className="text-muted-foreground hover:text-foreground cursor-pointer"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground mb-1">
                                                Drag & drop foto bukti pembelian
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                atau{" "}
                                                <label className="text-primary cursor-pointer hover:underline">
                                                    pilih file
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={handleFileChange}
                                                    />
                                                </label>
                                            </p>
                                        </>
                                    )}
                                </div>
                                {errors.file && (
                                    <p className="text-xs text-red-500">{errors.file}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                size="lg"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Mengirim...
                                    </>
                                ) : (
                                    "Kirim Pendaftaran"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
