"use client";

import Link from "next/link";
import React from "react";
import { Activity, BadgeCheck, BookText, Camera, ClipboardList, Database, FileSpreadsheet, History, LayoutDashboard, MessageCircle, PieChart, QrCode, ShieldCheck, Trash2, Users, UserCog } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Summary {
    outlets: number;
    whitelistNumbers: number;
    otpEvents: number;
    imports: number;
    metrics: number;
}

interface Territory {
    id: string;
    name: string;
    type: "REGION" | "CLUSTER" | "AREA";
}

interface HealthStatus {
    database: { ok: boolean };
    waha: {
        configured: boolean;
        reachable: boolean;
        session: string;
        sessionStatus?: string;
        error?: string;
    };
}

const modules = [
    { href: "/admin/mitra/outlet", label: "Database Outlet", icon: Users, text: "Tambah, edit, hapus outlet dan QR satuan." },
    { href: "/admin/mitra/foto", label: "Monitoring Foto", icon: Camera, text: "Foto kosong atau kedaluwarsa per kategori, dengan ekspor Excel." },
    { href: "/admin/mitra/import", label: "Upload Data", icon: FileSpreadsheet, text: "Import outlet dan performa: preview, validasi, commit." },
    { href: "/admin/mitra/performance", label: "Performance", icon: Activity, text: "Metric dan input performansi outlet." },
    { href: "/admin/mitra/salesforce", label: "Salesforce", icon: BadgeCheck, text: "Master nama dan foto salesforce yang ditaut outlet." },
    { href: "/admin/mitra/market-share", label: "Market Share", icon: PieChart, text: "Pangsa pasar operator per kecamatan." },
    { href: "/admin/mitra/qr", label: "QR Bulk", icon: QrCode, text: "Export kartu QR 2 x 5 per lembar A4." },
    { href: "/admin/mitra/referensi", label: "Referensi Key", icon: BookText, text: "Daftar metricKey, programSlug, dan paramKey untuk berkas import." },
    { href: "/admin/mitra/perubahan", label: "Perubahan Outlet", icon: History, text: "Foto, long-lat, dan branding yang diubah dari Portal Mitra. Bisa diunduh Excel." },
    { href: "/admin/mitra/audit", label: "Audit", icon: ClipboardList, text: "Jejak perubahan dan export." },
];

export default function AdminMitraPage() {
    const [summary, setSummary] = React.useState<Summary | null>(null);
    const [territories, setTerritories] = React.useState<Territory[]>([]);
    const [health, setHealth] = React.useState<HealthStatus | null>(null);
    const [cleaning, setCleaning] = React.useState(false);
    const [territoryForm, setTerritoryForm] = React.useState({ name: "", type: "AREA", parentId: "" });

    const load = React.useCallback(() => {
        fetch("/api/admin/mitra")
            .then((res) => res.json())
            .then((data) => setSummary(data.summary || null))
            .catch(() => setSummary(null));
        fetch("/api/admin/mitra?resource=territories")
            .then((res) => res.ok ? res.json() : { territories: [] })
            .then((data) => setTerritories(Array.isArray(data.territories) ? data.territories : []));
        fetch("/api/admin/mitra?resource=health")
            .then((res) => res.ok ? res.json() : null)
            .then(setHealth)
            .catch(() => setHealth(null));
    }, []);

    React.useEffect(() => { load(); }, [load]);

    const saveTerritory = async (event: React.FormEvent) => {
        event.preventDefault();
        await fetch("/api/admin/mitra", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: "territory", ...territoryForm }),
        });
        setTerritoryForm({ name: "", type: "AREA", parentId: "" });
        load();
    };

    const cleanupExpiredAccess = async () => {
        setCleaning(true);
        const res = await fetch("/api/admin/mitra", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: "cleanup" }),
        });
        const data = await res.json().catch(() => ({}));
        setCleaning(false);
        if (!res.ok) {
            alert(data.error || "Cleanup gagal");
            return;
        }
        alert(`Cleanup selesai: ${data.removed?.otpRequests || 0} OTP dan ${data.removed?.detailSessions || 0} session dihapus.`);
        load();
    };

    const stats = [
        { label: "Outlet", value: summary?.outlets ?? 0 },
        { label: "Whitelist OTP", value: summary?.whitelistNumbers ?? 0 },
        { label: "Event OTP", value: summary?.otpEvents ?? 0 },
        { label: "Import", value: summary?.imports ?? 0 },
        { label: "Metric", value: summary?.metrics ?? 0 },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Database Mitra Outlet</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Data outlet, upload, QR, performansi, dan audit. Program dikelola di menu Event &amp; Form, whitelist OTP di Pengaturan.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                    <ShieldCheck className="h-4 w-4" />
                    Role guard aktif
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {stats.map((stat) => (
                    <Card key={stat.label}>
                        <CardContent className="p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                            <p className="mt-2 text-2xl font-extrabold text-gray-950">{stat.value.toLocaleString("id-ID")}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-4 text-sm">
                        <span className="inline-flex items-center gap-2 font-semibold">
                            <Database className="h-4 w-4 text-red-600" />
                            Database {health?.database.ok ? "terhubung" : "tidak tersedia"}
                        </span>
                        {/* Alasannya ikut ditampilkan: "tidak terjangkau" saja tidak memberi
                            tahu apakah yang salah endpoint, API key, atau sesinya. */}
                        <span className="inline-flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-2 font-semibold">
                                <MessageCircle className="h-4 w-4 text-red-600" />
                                WAHA {!health?.waha.configured
                                    ? "belum dikonfigurasi"
                                    : health.waha.reachable && !health.waha.error
                                        ? `terhubung (sesi ${health.waha.sessionStatus || health.waha.session})`
                                        : health.waha.reachable
                                            ? "terhubung dengan catatan"
                                            : "tidak terjangkau"}
                            </span>
                            {health?.waha.error && (
                                <span className="text-xs font-normal text-muted-foreground">{health.waha.error}</span>
                            )}
                        </span>
                    </div>
                    <Button variant="outline" onClick={cleanupExpiredAccess} disabled={cleaning}>
                        <Trash2 className="h-4 w-4" />
                        {cleaning ? "Membersihkan..." : "Cleanup akses kedaluwarsa"}
                    </Button>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => (
                    <Link key={module.href} href={module.href} className="rounded-lg border bg-white p-5 shadow-sm transition hover:border-red-200 hover:shadow-md">
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-red-600">
                            <module.icon className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                            <h2 className="font-bold">{module.label}</h2>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.text}</p>
                    </Link>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardContent className="p-5">
                        <h2 className="font-bold">Territory</h2>
                        <form onSubmit={saveTerritory} className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Nama Wilayah</Label>
                                <Input value={territoryForm.name} onChange={(event) => setTerritoryForm((prev) => ({ ...prev, name: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Tipe</Label>
                                <select value={territoryForm.type} onChange={(event) => setTerritoryForm((prev) => ({ ...prev, type: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="REGION">REGION</option>
                                    <option value="CLUSTER">CLUSTER</option>
                                    <option value="AREA">AREA</option>
                                </select>
                            </div>
                            <Button className="sm:col-span-3">Tambah Territory</Button>
                        </form>
                        <div className="mt-4 max-h-56 space-y-2 overflow-auto">
                            {territories.map((territory) => (
                                <div key={territory.id} className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                                    <span className="font-semibold">{territory.name}</span>
                                    <span className="text-xs text-muted-foreground">{territory.type}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex flex-col items-start gap-3 p-5">
                        <h2 className="font-bold">Kelola User</h2>
                        <p className="text-sm text-muted-foreground">
                            Pengelolaan role, akun, dan wilayah user internal sudah dipindahkan ke halaman
                            Kelola User (khusus Admin Super).
                        </p>
                        <Link href="/admin/users">
                            <Button variant="outline">
                                <UserCog className="h-4 w-4" />
                                Buka Kelola User
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
