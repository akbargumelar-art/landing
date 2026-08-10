"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, Upload, Globe, MapPin, Phone, Plus, Trash2, MessageSquare, CreditCard } from "lucide-react";
import { WhitelistOtpSettings } from "@/components/admin/whitelist-otp-settings";

/**
 * Salinan tampilan dari DEFAULT_VISIT_TEMPLATE di lib/whatsapp.ts, dipakai sebagai
 * placeholder saja. Sengaja tidak diimpor: modul itu membuka koneksi database, sedangkan
 * halaman ini berjalan di browser. Yang menentukan isi pesan tetap yang di server.
 */
const CONTOH_TEMPLATE_KUNJUNGAN = `*Semangattt pagiii..*
Berikut update visit abkciraya.cloud/mitra

Salesforce : {salesforce}
ID Digipos : {digipos}
Nama Outlet : {outlet}
Keterangan : Edit long-lat jika terjadi perubahan longlat`;

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

function normalizeSettings(data: unknown): Record<string, string> {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(data as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === "string" ? value : value == null ? "" : String(value),
        ])
    );
}

function getWebhookUrl(origin: string, path: string) {
    return origin ? `${origin}${path}` : "";
}

export default function PengaturanPage() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [offices, setOffices] = useState<OfficeData[]>(defaultOffices);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [origin, setOrigin] = useState("");
    const [wahaTestPhone, setWahaTestPhone] = useState("");
    const [wahaTesting, setWahaTesting] = useState(false);
    const [wahaResult, setWahaResult] = useState<{ ok: boolean; lines: string[] } | null>(null);

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    useEffect(() => {
        fetch("/api/admin/settings")
            .then((r) => r.json())
            .then((data) => {
                const normalizedSettings = normalizeSettings(data);
                setSettings(normalizedSettings);
                if (normalizedSettings.office_data) {
                    try { setOffices(JSON.parse(normalizedSettings.office_data)); } catch { /* use default */ }
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

    const runWahaTest = async () => {
        setWahaTesting(true);
        setWahaResult(null);
        try {
            const res = await fetch("/api/admin/settings/waha-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: wahaTestPhone.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setWahaResult({ ok: false, lines: [data.error || "Tes koneksi gagal dijalankan."] });
                return;
            }

            const d = data.diagnostics || {};
            const lines: string[] = [];

            if (!d.configured) {
                lines.push("Endpoint WAHA belum diisi. Isi lalu simpan pengaturan dulu.");
            } else {
                lines.push(`Endpoint: ${d.endpoint}`);
                lines.push(`Session: ${d.session}${d.sessionStatus ? ` (${d.sessionStatus})` : ""}`);
                lines.push(`API key: ${d.hasToken ? "terisi" : "kosong"}`);
                lines.push(d.reachable ? "Server WAHA dapat dihubungi." : "Server WAHA TIDAK dapat dihubungi.");
            }
            if (d.error) lines.push(d.error);

            if (data.sent) {
                lines.push(data.sent.ok
                    ? `Pesan uji terkirim ke ${wahaTestPhone.trim()}. Cek WhatsApp nomor tersebut.`
                    : `Pesan uji gagal: ${data.sent.error}`);
            }

            const ok = Boolean(d.configured && d.reachable && !d.error && (!data.sent || data.sent.ok));
            setWahaResult({ ok, lines });
        } catch {
            setWahaResult({ ok: false, lines: ["Tidak dapat menghubungi server aplikasi."] });
        } finally {
            setWahaTesting(false);
        }
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
                                    <img src={settings.logo_url} alt="Logo" className="h-12 w-auto object-contain rounded border" />
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
                                    <img src={settings.favicon_url} alt="Favicon" className="h-8 w-8 object-contain rounded border" />
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
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nomor WhatsApp</Label>
                            <Input value={settings.whatsapp || ""} onChange={(e) => updateSetting("whatsapp", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>URL WhatsApp</Label>
                            <Input value={settings.whatsapp_url || ""} onChange={(e) => updateSetting("whatsapp_url", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Handle Instagram</Label>
                            <Input value={settings.instagram_handle || ""} onChange={(e) => updateSetting("instagram_handle", e.target.value)} placeholder="@agrabudikomunika" />
                        </div>
                        <div className="space-y-2">
                            <Label>URL Instagram</Label>
                            <Input value={settings.instagram_url || ""} onChange={(e) => updateSetting("instagram_url", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Nama Facebook</Label>
                            <Input value={settings.facebook_name || ""} onChange={(e) => updateSetting("facebook_name", e.target.value)} placeholder="ABK Ciraya" />
                        </div>
                        <div className="space-y-2">
                            <Label>URL Facebook</Label>
                            <Input value={settings.facebook_url || ""} onChange={(e) => updateSetting("facebook_url", e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t">
                        <Label>Kalimat Pembuka WhatsApp</Label>
                        <textarea
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={settings.wa_greeting || ""}
                            onChange={(e) => updateSetting("wa_greeting", e.target.value)}
                            placeholder="Halo Kak, saya lihat di website ABK Ciraya."
                        />
                        <p className="text-xs text-muted-foreground">
                            Pesan ini akan otomatis terisi saat pengunjung klik tombol WhatsApp di halaman Kontak, Footer, dan Kalkulator Cuan. Kosongkan jika tidak ingin menggunakan kalimat pembuka otomatis.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* WhatsApp Integration */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" /> WhatsApp Gateway (WAHA)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Koneksi WhatsApp untuk <strong>seluruh aplikasi</strong>: OTP Database Mitra Outlet,
                        notifikasi pendaftaran program, dan fitur lain berikutnya. Isi pesannya diatur
                        terpisah per fitur — template program undian ada di halaman Kelola Program.
                        Jika endpoint dikosongkan, seluruh pengiriman WhatsApp berhenti.
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
                        <Label>Template Pesan OTP (Database Mitra Outlet)</Label>
                        <textarea
                            className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={settings.wa_otp_template || ""}
                            onChange={(e) => updateSetting("wa_otp_template", e.target.value)}
                            placeholder="Kode OTP Portal Mitra Outlet {outlet}: {otp}. Berlaku {expires}."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Placeholder: <code>&#123;otp&#125;</code>, <code>&#123;outlet&#125;</code>, <code>&#123;expires&#125;</code>.
                            Dikosongkan berarti memakai template bawaan.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Template Konfirmasi Pengajuan IndiHome</Label>
                        <textarea
                            className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={settings.wa_indihome_template || ""}
                            onChange={(e) => updateSetting("wa_indihome_template", e.target.value)}
                            placeholder="Halo {nama}, pengajuan IndiHome {paket} untuk {lokasi} sudah kami terima. Nomor referensi: {referensi}."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Dikirim otomatis ke pendaftar setelah form langganan tersimpan. Placeholder:
                            <code> &#123;nama&#125;</code>, <code>&#123;paket&#125;</code>, <code>&#123;lokasi&#125;</code>, <code>&#123;referensi&#125;</code>.
                        </p>
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold">Notifikasi Kunjungan ke Group</p>
                                <p className="text-xs text-muted-foreground">
                                    Mengirim satu pesan ke group setiap salesforce selesai memperbarui foto
                                    outlet. Satu kunjungan (satu sesi OTP) = satu pesan, dikirim sekitar
                                    2 menit setelah unggahan terakhir, dengan satu foto yang diundi dari
                                    foto yang baru diunggah. Perubahan long-lat tidak dikirim ke group.
                                </p>
                            </div>
                            <label className="flex shrink-0 items-center gap-2 text-sm font-semibold">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={settings.wa_visit_enabled === "1"}
                                    onChange={(e) => updateSetting("wa_visit_enabled", e.target.checked ? "1" : "0")}
                                />
                                Aktif
                            </label>
                        </div>

                        <div className="space-y-2">
                            <Label>Chat ID Group WhatsApp</Label>
                            <Input
                                value={settings.wa_visit_group_id || ""}
                                onChange={(e) => updateSetting("wa_visit_group_id", e.target.value)}
                                placeholder="Contoh: 120363044814127701@g.us"
                            />
                            <p className="text-xs text-muted-foreground">
                                Ambil dari WAHA lewat <code>GET /api/&#123;session&#125;/groups</code>. Harus diakhiri
                                <code> @g.us</code>. Dikosongkan berarti notifikasi tidak dikirim.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Template Pesan Kunjungan</Label>
                            <textarea
                                className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={settings.wa_visit_template || ""}
                                onChange={(e) => updateSetting("wa_visit_template", e.target.value)}
                                placeholder={CONTOH_TEMPLATE_KUNJUNGAN}
                            />
                            <p className="text-xs text-muted-foreground">
                                Dipakai sebagai caption foto. Placeholder: <code>&#123;salesforce&#125;</code>,
                                <code> &#123;digipos&#125;</code>, <code>&#123;outlet&#125;</code>, <code>&#123;tap&#125;</code>,
                                <code> &#123;foto&#125;</code>, <code>&#123;perubahan&#125;</code>, <code>&#123;tanggal&#125;</code>,
                                <code> &#123;link&#125;</code>. Dikosongkan berarti memakai template bawaan.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                <code>&#123;foto&#125;</code> berisi jenis foto yang terundi, mis.
                                &quot;Foto Tampak Depan&quot; atau &quot;Foto POP Kompetitor&quot;. Bila template
                                tidak memuatnya, keterangan itu otomatis dipasang tebal di baris pertama.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
                        <div>
                            <p className="text-sm font-semibold">Tes Koneksi</p>
                            <p className="text-xs text-muted-foreground">
                                Memeriksa server dan status session WAHA. Isi nomor bila ingin sekalian
                                mengirim pesan uji. <strong>Simpan pengaturan dulu</strong> sebelum menguji.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                value={wahaTestPhone}
                                onChange={(e) => setWahaTestPhone(e.target.value)}
                                placeholder="Nomor tujuan uji (opsional), mis. 081234567890"
                            />
                            <Button type="button" variant="outline" onClick={runWahaTest} disabled={wahaTesting} className="shrink-0">
                                {wahaTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                                Tes Koneksi
                            </Button>
                        </div>
                        {wahaResult && (
                            <div className={`rounded-md border px-3 py-2 text-sm ${wahaResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`} role="status">
                                {wahaResult.lines.map((line, index) => <p key={index}>{line}</p>)}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <WhitelistOtpSettings />

            {/* Active Payment Gateway Selector */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="h-5 w-5" /> Pilihan Payment Gateway Aktif
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Pilih payment gateway yang digunakan untuk memproses pembayaran order baru.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => updateSetting("payment_gateway_active", "mayar")}
                            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${(!settings.payment_gateway_active || settings.payment_gateway_active === "mayar")
                                    ? "border-red-500 bg-red-50 ring-2 ring-red-200"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                        >
                            <div className="font-bold text-sm">Mayar.id</div>
                            <p className="text-xs text-muted-foreground mt-1">Invoice-based payment gateway</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => updateSetting("payment_gateway_active", "midtrans")}
                            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${settings.payment_gateway_active === "midtrans"
                                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                        >
                            <div className="font-bold text-sm">Midtrans</div>
                            <p className="text-xs text-muted-foreground mt-1">Snap API payment gateway</p>
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Payment Gateway Mayar.id */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="h-5 w-5" /> Payment Gateway (Mayar.id)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Konfigurasi integrasi pembayaran Mayar.id untuk halaman belanja.
                        Dapatkan API Key dari dashboard Mayar.id Anda.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input
                                type="password"
                                value={settings.mayar_api_key || ""}
                                onChange={(e) => updateSetting("mayar_api_key", e.target.value)}
                                placeholder="Masukkan API Key dari Dashboard Mayar.id"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Mode</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={settings.mayar_mode || "sandbox"}
                                onChange={(e) => updateSetting("mayar_mode", e.target.value)}
                            >
                                <option value="sandbox">Sandbox (Testing via mayar.club)</option>
                                <option value="production">Production (Live via mayar.id)</option>
                            </select>
                            <p className="text-xs text-muted-foreground">Gunakan mode Sandbox untuk testing sebelum beralih ke Production.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Callback / Webhook URL</Label>
                            <Input
                                readOnly
                                value={getWebhookUrl(origin, "/api/public/webhook/mayar")}
                                className="bg-gray-50 text-muted-foreground cursor-default"
                            />
                            <p className="text-xs text-muted-foreground">URL ini harus didaftarkan di Dashboard Mayar.id → Pengaturan → Webhooks.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Webhook Token</Label>
                            <Input
                                type="password"
                                value={settings.mayar_webhook_token || ""}
                                onChange={(e) => updateSetting("mayar_webhook_token", e.target.value)}
                                placeholder="Token webhook dari Dashboard Mayar.id"
                            />
                            <p className="text-xs text-muted-foreground">
                                <strong>Wajib diisi.</strong> Tanpa token ini webhook Mayar ditolak, sehingga
                                pembayaran tidak akan tercatat otomatis. Token inilah yang membuktikan
                                notifikasi benar-benar berasal dari Mayar dan bukan dari orang lain yang
                                menebak nomor invoice.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Payment Gateway Midtrans */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="h-5 w-5" /> Payment Gateway (Midtrans)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Konfigurasi integrasi pembayaran Midtrans Snap API untuk halaman belanja.
                        Dapatkan credentials dari dashboard.midtrans.com → Settings → Access Keys.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Server Key</Label>
                            <Input
                                type="password"
                                value={settings.midtrans_server_key || ""}
                                onChange={(e) => updateSetting("midtrans_server_key", e.target.value)}
                                placeholder="SB-Mid-server-xxxx (Sandbox) atau Mid-server-xxxx"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Client Key</Label>
                            <Input
                                type="password"
                                value={settings.midtrans_client_key || ""}
                                onChange={(e) => updateSetting("midtrans_client_key", e.target.value)}
                                placeholder="SB-Mid-client-xxxx (Sandbox) atau Mid-client-xxxx"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Mode</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={settings.midtrans_mode || "sandbox"}
                                onChange={(e) => updateSetting("midtrans_mode", e.target.value)}
                            >
                                <option value="sandbox">Sandbox (Testing)</option>
                                <option value="production">Production (Live)</option>
                            </select>
                            <p className="text-xs text-muted-foreground">Gunakan mode Sandbox untuk testing sebelum beralih ke Production.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Notification / Webhook URL</Label>
                            <Input
                                readOnly
                                value={getWebhookUrl(origin, "/api/public/webhook/midtrans")}
                                className="bg-gray-50 text-muted-foreground cursor-default"
                            />
                            <p className="text-xs text-muted-foreground">URL ini harus didaftarkan di Dashboard Midtrans → Settings → Payment → Notification URL.</p>
                        </div>
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
