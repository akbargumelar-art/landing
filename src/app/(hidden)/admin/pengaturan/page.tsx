"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, Upload, Globe, MapPin, Phone, Plus, Trash2, MessageSquare } from "lucide-react";
import Image from "next/image";

interface OfficeData {
    city: string;
    label: string;
    image: string;
    address: string;
    phone: string;
    mapUrl: string;
}

const defaultOffices: OfficeData[] = [
    {
        city: "CIREBON", label: "Kantor Pusat Cirebon", image: "/images/office-cirebon.png",
        address: "Jl. Pemuda Raya No.21B, Sunyaragi, Kec. Kesambi, Kota Cirebon, Jawa Barat 45132",
        phone: "+62 851-6882-2280", mapUrl: "https://www.google.com/maps/search/Jl.+Pemuda+Raya+No.21B+Sunyaragi+Kesambi+Kota+Cirebon",
    },
    {
        city: "KUNINGAN", label: "Kantor Cabang Kuningan", image: "/images/office-kuningan.png",
        address: "Jl. Siliwangi No.45, Purwawinangun, Kec. Kuningan, Kabupaten Kuningan, Jawa Barat 45512",
        phone: "+62 851-6882-2280", mapUrl: "https://www.google.com/maps/search/Jl.+Siliwangi+No.45+Purwawinangun+Kuningan",
    },
];

export default function PengaturanPage() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [offices, setOffices] = useState<OfficeData[]>(defaultOffices);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        fetch("/api/admin/settings")
            .then((r) => r.json())
            .then((data) => {
                setSettings(data);
                if (data.office_data) {
                    try { setOffices(JSON.parse(data.office_data)); } catch { /* use default */ }
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const updateSetting = (key: string, value: string) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleUpload = async (key: string) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (data.url) updateSetting(key, data.url);
        };
        input.click();
    };

    // Office CRUD
    const updateOfficeField = (index: number, field: keyof OfficeData, value: string) => {
        setOffices(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
    };

    const addOffice = () => {
        setOffices(prev => [...prev, { city: "", label: "Kantor Baru", image: "", address: "", phone: "", mapUrl: "" }]);
    };

    const removeOffice = (index: number) => {
        if (!confirm(`Hapus kantor "${offices[index].label || 'ini'}"?`)) return;
        setOffices(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        try {
            // Merge offices into settings
            const allSettings = { ...settings, office_data: JSON.stringify(offices) };
            const settingsArray = Object.entries(allSettings).map(([key, value]) => ({
                key,
                value,
                type: key.includes("url") || key.includes("logo") || key.includes("favicon") ? "image" : key.includes("office") ? "json" : "text",
            }));
            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ settings: settingsArray }),
            });
            if (res.ok) setMessage("Pengaturan berhasil disimpan!");
            else setMessage("Gagal menyimpan pengaturan");
        } catch { setMessage("Terjadi kesalahan"); }
        setSaving(false);
        setTimeout(() => setMessage(""), 3000);
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Pengaturan Website</h2>
                <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Simpan
                </Button>
            </div>

            {message && (
                <div className={`p-3 rounded-lg text-sm ${message.includes("berhasil") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {message}
                </div>
            )}

            {/* Logo & Favicon */}
            <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Globe className="h-5 w-5" /> Branding</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Logo Website</Label>
                            <div className="flex items-center gap-3">
                                {settings.logo_url ? (
                                    <Image src={settings.logo_url} alt="Logo" width={48} height={48} className="h-12 w-auto object-contain rounded border" unoptimized={true} />
                                ) : (
                                    <div className="h-12 w-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">No logo</div>
                                )}
                                <Button variant="outline" size="sm" onClick={() => handleUpload("logo_url")} className="cursor-pointer">
                                    <Upload className="mr-2 h-4 w-4" /> Upload Logo
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Favicon</Label>
                            <div className="flex items-center gap-3">
                                {settings.favicon_url ? (
                                    <Image src={settings.favicon_url} alt="Favicon" width={32} height={32} className="h-8 w-8 object-contain rounded border" unoptimized={true} />
                                ) : (
                                    <div className="h-8 w-8 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">—</div>
                                )}
                                <Button variant="outline" size="sm" onClick={() => handleUpload("favicon_url")} className="cursor-pointer">
                                    <Upload className="mr-2 h-4 w-4" /> Upload
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nama Website</Label>
                            <Input value={settings.site_name || ""} onChange={(e) => updateSetting("site_name", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Tagline</Label>
                            <Input value={settings.site_tagline || ""} onChange={(e) => updateSetting("site_tagline", e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Contact */}
            <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Phone className="h-5 w-5" /> Kontak & Sosial Media</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Nomor WhatsApp</Label>
                        <Input value={settings.whatsapp || ""} onChange={(e) => updateSetting("whatsapp", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>URL WhatsApp</Label>
                        <Input value={settings.whatsapp_url || ""} onChange={(e) => updateSetting("whatsapp_url", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>URL Instagram</Label>
                        <Input value={settings.instagram_url || ""} onChange={(e) => updateSetting("instagram_url", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>URL Facebook</Label>
                        <Input value={settings.facebook_url || ""} onChange={(e) => updateSetting("facebook_url", e.target.value)} />
                    </div>
                </CardContent>
            </Card>

            {/* WhatsApp Integration */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" /> Integrasi & Notifikasi WhatsApp API
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Pengaturan ini digunakan untuk mengirim pesan notifikasi WhatsApp otomatis kepada pendaftar.
                        Jika dibiarkan kosong, fitur notifikasi tidak akan berjalan.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nama Session WAHA</Label>
                            <Input
                                value={settings.wa_gw_session || ""}
                                onChange={(e) => updateSetting("wa_gw_session", e.target.value)}
                                placeholder="default"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Endpoint API URL (POST)</Label>
                            <Input
                                value={settings.wa_gw_endpoint || ""}
                                onChange={(e) => updateSetting("wa_gw_endpoint", e.target.value)}
                                placeholder="Contoh: http://waha-instance.com/api/sendText"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>API Key / Token</Label>
                            <Input
                                type="password"
                                value={settings.wa_gw_token || ""}
                                onChange={(e) => updateSetting("wa_gw_token", e.target.value)}
                                placeholder="Masukkan token rahasia"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Template Pesan Notifikasi</Label>
                        <textarea
                            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={settings.wa_gw_template || ""}
                            onChange={(e) => updateSetting("wa_gw_template", e.target.value)}
                            placeholder="Halo {nama}, pendaftaran Anda untuk {program} berhasil."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Gunakan <code>&#123;nama&#125;</code> untuk nama peserta, dan <code>&#123;program&#125;</code> untuk judul program pendaftaran.
                            Variabel lain akan menyusul sesuai label di formulir.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Offices - Dynamic */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" /> Alamat Kantor</CardTitle>
                    <Button size="sm" onClick={addOffice} className="cursor-pointer">
                        <Plus className="mr-1 h-4 w-4" /> Tambah Kantor
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {offices.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">Belum ada kantor. Klik &quot;Tambah Kantor&quot; untuk menambah.</p>
                    )}
                    {offices.map((office, i) => (
                        <div key={i} className="p-4 rounded-xl border bg-gray-50/50 space-y-3 relative">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm">{office.label || `Kantor ${i + 1}`}</h4>
                                <button onClick={() => removeOffice(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer" title="Hapus kantor">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Nama / Label Kantor</Label>
                                    <Input value={office.label} onChange={(e) => updateOfficeField(i, "label", e.target.value)} placeholder="Kantor Pusat Cirebon" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Kode Kota</Label>
                                    <Input value={office.city} onChange={(e) => updateOfficeField(i, "city", e.target.value)} placeholder="CIREBON" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Alamat Lengkap</Label>
                                <Input value={office.address} onChange={(e) => updateOfficeField(i, "address", e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Telepon</Label>
                                    <Input value={office.phone} onChange={(e) => updateOfficeField(i, "phone", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Link Google Maps</Label>
                                    <Input value={office.mapUrl} onChange={(e) => updateOfficeField(i, "mapUrl", e.target.value)} />
                                </div>
                            </div>
                        </div>
                    ))}
                    <p className="text-xs text-muted-foreground">Foto kantor diatur di halaman Kelola Beranda. Tekan Simpan setelah selesai mengubah.</p>
                </CardContent>
            </Card>
        </div >
    );
}
