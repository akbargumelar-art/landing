"use client";

import React from "react";
import { Loader2, Plus, ShieldCheck, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminRole = "SUPER_ADMIN" | "ADMIN_INPUT" | "MANAGER" | "SUPERVISOR" | "SALESFORCE";

const ROLE_LABELS: Record<AdminRole, string> = {
    SUPER_ADMIN: "Admin Super",
    ADMIN_INPUT: "Admin Input",
    MANAGER: "Manager",
    SUPERVISOR: "Supervisor",
    SALESFORCE: "Salesforce",
};

const TERRITORY_SCOPED: AdminRole[] = ["SUPERVISOR", "SALESFORCE"];

interface AdminUser {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: AdminRole;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    territoryIds: string[];
}

interface Territory {
    id: string;
    name: string;
    type: "REGION" | "CLUSTER" | "AREA";
}

const emptyDraft = {
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "MANAGER" as AdminRole,
    territoryIds: [] as string[],
};

export default function AdminUsersPage() {
    const [users, setUsers] = React.useState<AdminUser[]>([]);
    const [territories, setTerritories] = React.useState<Territory[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState("");
    const [forbidden, setForbidden] = React.useState(false);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [draft, setDraft] = React.useState(emptyDraft);
    const [editingUser, setEditingUser] = React.useState<AdminUser | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/users");
            if (response.status === 403) {
                setForbidden(true);
                return;
            }
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Gagal memuat user.");
            setUsers(data.users || []);
            setTerritories(data.territories || []);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Gagal memuat user.");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { load(); }, [load]);

    function openAdd() {
        setEditingUser(null);
        setDraft(emptyDraft);
        setDialogOpen(true);
        setMessage("");
    }

    function openEdit(user: AdminUser) {
        setEditingUser(user);
        setDraft({
            name: user.name,
            email: user.email,
            password: "",
            phone: user.phone || "",
            role: user.role,
            territoryIds: user.territoryIds,
        });
        setDialogOpen(true);
        setMessage("");
    }

    function toggleTerritory(id: string) {
        setDraft((current) => ({
            ...current,
            territoryIds: current.territoryIds.includes(id)
                ? current.territoryIds.filter((item) => item !== id)
                : [...current.territoryIds, id],
        }));
    }

    async function saveUser(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setMessage("");

        try {
            if (editingUser) {
                const response = await fetch(`/api/admin/users/${editingUser.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        role: draft.role,
                        phone: draft.phone,
                        isActive: editingUser.isActive,
                        territoryIds: draft.territoryIds,
                    }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Gagal menyimpan user.");
            } else {
                const response = await fetch("/api/admin/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(draft),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Gagal membuat user.");
            }
            setDialogOpen(false);
            await load();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Gagal menyimpan user.");
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(user: AdminUser) {
        const response = await fetch(`/api/admin/users/${user.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: user.role, isActive: !user.isActive, territoryIds: user.territoryIds }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setMessage(data.error || "Gagal mengubah status user.");
            return;
        }
        load();
    }

    if (forbidden) {
        return (
            <Card>
                <CardContent className="py-14 text-center text-sm text-muted-foreground">
                    Halaman ini hanya dapat diakses oleh Admin Super.
                </CardContent>
            </Card>
        );
    }

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-red-600" /></div>;

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-950"><UserCog className="h-6 w-6" /> Kelola User</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Buat akun, atur role, dan tetapkan wilayah untuk user internal.</p>
                </div>
                <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700"><Plus className="mr-2 h-4 w-4" /> Tambah User</Button>
            </div>

            {message && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{message}</div>}

            <Card>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {users.length === 0 ? (
                            <p className="p-8 text-center text-sm text-muted-foreground">Belum ada user.</p>
                        ) : users.map((user) => (
                            <div key={user.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-semibold text-gray-950">{user.name}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                    {TERRITORY_SCOPED.includes(user.role) && (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Wilayah: {user.territoryIds.length > 0
                                                ? territories.filter((t) => user.territoryIds.includes(t.id)).map((t) => t.name).join(", ")
                                                : "Belum ditetapkan"}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                                        <ShieldCheck className="h-3.5 w-3.5" /> {ROLE_LABELS[user.role]}
                                    </span>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                        {user.isActive ? "Aktif" : "Nonaktif"}
                                    </span>
                                    <Button variant="outline" size="sm" onClick={() => openEdit(user)}>Edit</Button>
                                    <Button variant="outline" size="sm" onClick={() => toggleActive(user)}>
                                        {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>{editingUser ? "Edit User" : "Tambah User"}</DialogTitle></DialogHeader>
                    <form onSubmit={saveUser} className="space-y-4">
                        {!editingUser && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="user-name">Nama</Label>
                                    <Input id="user-name" required minLength={2} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="user-email">Email</Label>
                                    <Input id="user-email" type="email" required value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="user-password">Password awal</Label>
                                    <Input id="user-password" type="password" required minLength={8} value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
                                </div>
                            </>
                        )}
                        {editingUser && (
                            <div className="rounded-lg bg-gray-50 p-3 text-sm">
                                <p className="font-semibold">{editingUser.name}</p>
                                <p className="text-muted-foreground">{editingUser.email}</p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="user-phone">Nomor WhatsApp (opsional)</Label>
                            <Input id="user-phone" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="user-role">Role</Label>
                            <select
                                id="user-role"
                                value={draft.role}
                                onChange={(event) => setDraft({ ...draft, role: event.target.value as AdminRole })}
                                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
                            >
                                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        {TERRITORY_SCOPED.includes(draft.role) && (
                            <div className="space-y-2">
                                <Label>Wilayah</Label>
                                <div className="grid max-h-40 gap-2 overflow-auto rounded-lg border p-3 sm:grid-cols-2">
                                    {territories.map((territory) => (
                                        <label key={territory.id} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={draft.territoryIds.includes(territory.id)}
                                                onChange={() => toggleTerritory(territory.id)}
                                                className="h-4 w-4 accent-red-600"
                                            />
                                            {territory.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        {message && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700">
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Simpan
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
