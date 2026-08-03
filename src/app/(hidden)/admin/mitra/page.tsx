"use client";

import Link from "next/link";
import React from "react";
import { Activity, ClipboardList, Database, FileSpreadsheet, KeyRound, LayoutDashboard, MessageCircle, QrCode, ShieldCheck, Trash2, Trophy, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Summary {
    outlets: number;
    activePrograms: number;
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

interface MitraUser {
    id: string;
    name: string;
    email: string;
    role: "MANAGER" | "ADMIN" | "LEADER";
    isActive: boolean;
}

interface HealthStatus {
    database: { ok: boolean };
    waha: { configured: boolean; reachable: boolean; session: string };
}

const modules = [
    { href: "/admin/mitra/outlet", label: "Outlet", icon: Users, text: "CRUD outlet, QR single, token publik." },
    { href: "/admin/mitra/whitelist", label: "Whitelist", icon: KeyRound, text: "Nomor OTP dan scope akses." },
    { href: "/admin/mitra/performance", label: "Performance", icon: Activity, text: "Metric dan input performansi." },
    { href: "/admin/mitra/program", label: "Program", icon: Trophy, text: "Program builder dan leaderboard." },
    { href: "/admin/mitra/import", label: "Import", icon: FileSpreadsheet, text: "Preview, validasi, commit, history." },
    { href: "/admin/mitra/qr", label: "QR Bulk", icon: QrCode, text: "Export kartu QR 2 x 5 A4." },
    { href: "/admin/mitra/audit", label: "Audit", icon: ClipboardList, text: "Jejak perubahan dan export." },
];

export default function AdminMitraPage() {
    const [summary, setSummary] = React.useState<Summary | null>(null);
    const [territories, setTerritories] = React.useState<Territory[]>([]);
    const [users, setUsers] = React.useState<MitraUser[]>([]);
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
        fetch("/api/admin/mitra?resource=users")
            .then((res) => res.ok ? res.json() : { users: [] })
            .then((data) => setUsers(Array.isArray(data.users) ? data.users : []));
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

    const updateUserRole = async (userId: string, role: string, isActive: boolean) => {
        await fetch("/api/admin/mitra", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: "user_profile", userId, role, isActive }),
        });
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
        { label: "Program Aktif", value: summary?.activePrograms ?? 0 },
        { label: "Whitelist", value: summary?.whitelistNumbers ?? 0 },
        { label: "Event OTP", value: summary?.otpEvents ?? 0 },
        { label: "Import", value: summary?.imports ?? 0 },
        { label: "Metric", value: summary?.metrics ?? 0 },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Portal Mitra Outlet</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Operasional outlet, QR, OTP, performansi, program, dan audit.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                    <ShieldCheck className="h-4 w-4" />
                    Role guard aktif
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
                        <span className="inline-flex items-center gap-2 font-semibold">
                            <MessageCircle className="h-4 w-4 text-red-600" />
                            WAHA {!health?.waha.configured ? "belum dikonfigurasi" : health.waha.reachable ? "terhubung" : "tidak terjangkau"}
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
                    <CardContent className="p-5">
                        <h2 className="font-bold">User Role</h2>
                        <div className="mt-4 max-h-80 space-y-2 overflow-auto">
                            {users.map((item) => (
                                <div key={item.id} className="grid gap-2 rounded-lg border bg-gray-50 p-3 sm:grid-cols-[1fr_140px_100px] sm:items-center">
                                    <div>
                                        <p className="text-sm font-semibold">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.email}</p>
                                    </div>
                                    <select value={item.role} onChange={(event) => updateUserRole(item.id, event.target.value, item.isActive)} className="h-9 rounded-md border px-2 text-sm">
                                        <option value="MANAGER">MANAGER</option>
                                        <option value="ADMIN">ADMIN</option>
                                        <option value="LEADER">LEADER</option>
                                    </select>
                                    <Button variant="outline" size="sm" onClick={() => updateUserRole(item.id, item.role, !item.isActive)}>
                                        {item.isActive ? "Aktif" : "Nonaktif"}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
