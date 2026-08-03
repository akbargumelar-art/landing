"use client";

import Link from "next/link";
import React from "react";
import { Download, ExternalLink, Loader2, Pencil, Plus, QrCode, Save, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MITRA_DETAIL_FIELD_GROUPS } from "@/lib/mitra-fields";

interface Outlet {
    id: string;
    outletCode: string;
    publicToken: string;
    name: string;
    ownerName: string;
    ownerPhone: string;
    kabupaten: string;
    kecamatan: string;
    status: string;
    territoryName?: string;
}

interface Territory {
    id: string;
    name: string;
}

export default function AdminMitraOutletPage() {
    const [outlets, setOutlets] = React.useState<Outlet[]>([]);
    const [territories, setTerritories] = React.useState<Territory[]>([]);
    const [q, setQ] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [editOutlet, setEditOutlet] = React.useState<Record<string, unknown> | null>(null);
    const [editDetails, setEditDetails] = React.useState<Record<string, Record<string, string | number>>>({});
    const [editSaving, setEditSaving] = React.useState(false);
    const [form, setForm] = React.useState({
        outletCode: "",
        name: "",
        ownerName: "",
        ownerPhone: "",
        kabupaten: "",
        kecamatan: "",
        territoryId: "",
        category: "FISIK",
        pjpDay: "Senin",
        pjpType: "F1",
    });

    const load = React.useCallback(() => {
        setLoading(true);
        fetch(`/api/admin/mitra/outlets?q=${encodeURIComponent(q)}&pageSize=50`)
            .then((res) => res.json())
            .then((data) => {
                setOutlets(Array.isArray(data.outlets) ? data.outlets : []);
                setTerritories(Array.isArray(data.territories) ? data.territories : []);
            })
            .finally(() => setLoading(false));
    }, [q]);

    React.useEffect(() => { load(); }, [load]);

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        const res = await fetch("/api/admin/mitra/outlets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setForm({ outletCode: "", name: "", ownerName: "", ownerPhone: "", kabupaten: "", kecamatan: "", territoryId: "", category: "FISIK", pjpDay: "Senin", pjpType: "F1" });
            load();
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal menyimpan outlet");
        }
        setSaving(false);
    };

    const openEdit = async (outletId: string) => {
        const res = await fetch(`/api/admin/mitra/outlets/${outletId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || "Gagal memuat outlet");
        setEditOutlet(data.outlet);
        setEditDetails({
            sellthruDigiposJson: data.details?.sellthruDigiposJson || {},
            sellthruNotaJson: data.details?.sellthruNotaJson || {},
            rechargeDigiposJson: data.details?.rechargeDigiposJson || {},
        });
    };

    const updateEditField = (key: string, value: string) => {
        setEditOutlet((previous) => previous ? { ...previous, [key]: value } : previous);
    };

    const updateDetailField = (storageKey: string, key: string, value: string) => {
        setEditDetails((previous) => ({
            ...previous,
            [storageKey]: { ...(previous[storageKey] || {}), [key]: value },
        }));
    };

    const saveEdit = async () => {
        if (!editOutlet?.id) return;
        setEditSaving(true);
        const res = await fetch(`/api/admin/mitra/outlets/${editOutlet.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...editOutlet,
                sellthruDigipos: editDetails.sellthruDigiposJson || {},
                sellthruNota: editDetails.sellthruNotaJson || {},
                rechargeDigipos: editDetails.rechargeDigiposJson || {},
            }),
        });
        const data = await res.json().catch(() => ({}));
        setEditSaving(false);
        if (!res.ok) return alert(data.error || "Gagal memperbarui outlet");
        setEditOutlet(null);
        load();
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Outlet Mitra</h1>
                <p className="mt-1 text-sm text-muted-foreground">Kelola data outlet dan token QR publik.</p>
            </div>

            <Card>
                <CardContent className="p-5">
                    <form onSubmit={save} className="grid gap-3 md:grid-cols-4">
                        <Field label="Kode Outlet" value={form.outletCode} onChange={(value) => setForm((prev) => ({ ...prev, outletCode: value }))} />
                        <Field label="Nama Outlet" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
                        <Field label="Owner" value={form.ownerName} onChange={(value) => setForm((prev) => ({ ...prev, ownerName: value }))} />
                        <Field label="WA Owner" value={form.ownerPhone} onChange={(value) => setForm((prev) => ({ ...prev, ownerPhone: value }))} />
                        <Field label="Kabupaten" value={form.kabupaten} onChange={(value) => setForm((prev) => ({ ...prev, kabupaten: value }))} />
                        <Field label="Kecamatan" value={form.kecamatan} onChange={(value) => setForm((prev) => ({ ...prev, kecamatan: value }))} />
                        <div className="space-y-2">
                            <Label>Territory</Label>
                            <select value={form.territoryId} onChange={(event) => setForm((prev) => ({ ...prev, territoryId: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                <option value="">Tanpa territory</option>
                                {territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <Button disabled={saving} className="w-full">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Tambah Outlet
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {editOutlet && (
                <Card>
                    <CardContent className="space-y-5 p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="font-bold">Edit {String(editOutlet.name || "Outlet")}</h2>
                                <p className="text-sm text-muted-foreground">Data profil, status, lokasi, dan detail performa outlet.</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setEditOutlet(null)} aria-label="Tutup editor">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                            {[
                                ["outletCode", "Kode Outlet"], ["rsNumber", "Nomor RS"], ["name", "Nama Outlet"], ["ownerName", "Owner"],
                                ["ownerPhone", "WA Owner"], ["tap", "TAP"], ["salesforce", "Salesforce"], ["kabupaten", "Kabupaten"],
                                ["kecamatan", "Kecamatan"], ["longitude", "Longitude"], ["latitude", "Latitude"], ["locationUrl", "URL Lokasi"],
                                ["branding", "Branding"], ["photoUrl", "URL Foto"], ["pjpDay", "Hari PJP"], ["pjpType", "Tipe PJP"],
                            ].map(([key, label]) => (
                                <Field key={key} label={label} value={String(editOutlet[key] ?? "")} onChange={(value) => updateEditField(key, value)} />
                            ))}
                            <div className="space-y-2">
                                <Label>Territory</Label>
                                <select value={String(editOutlet.territoryId || "")} onChange={(event) => updateEditField("territoryId", event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="">Tanpa territory</option>
                                    {territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Kategori</Label>
                                <select value={String(editOutlet.category || "FISIK")} onChange={(event) => updateEditField("category", event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="FISIK">FISIK</option><option value="DIGITAL">DIGITAL</option><option value="HYBRID">HYBRID</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <select value={String(editOutlet.status || "ACTIVE")} onChange={(event) => updateEditField("status", event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="SUSPENDED">SUSPENDED</option>
                                </select>
                            </div>
                        </div>

                        {MITRA_DETAIL_FIELD_GROUPS.map((group) => (
                            <details key={group.key} className="rounded-lg border bg-gray-50 p-4">
                                <summary className="cursor-pointer font-bold">{group.title}</summary>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {group.fields.map((field) => (
                                        <Field
                                            key={field.key}
                                            label={field.label}
                                            value={String(editDetails[group.storageKey]?.[field.key] ?? "")}
                                            onChange={(value) => updateDetailField(group.storageKey, field.key, value)}
                                        />
                                    ))}
                                </div>
                            </details>
                        ))}

                        <Button onClick={saveEdit} disabled={editSaving}>
                            {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Simpan Perubahan
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-5">
                    <div className="mb-4 flex gap-2">
                        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari outlet, kode, wilayah, nomor" />
                        <Button onClick={load} size="icon" aria-label="Cari">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Outlet</TableHead>
                                <TableHead>Wilayah</TableHead>
                                <TableHead>Owner</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">QR</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                            ) : outlets.length ? outlets.map((outlet) => (
                                <TableRow key={outlet.id}>
                                    <TableCell>
                                        <p className="font-semibold">{outlet.name}</p>
                                        <p className="text-xs text-muted-foreground">{outlet.outletCode}</p>
                                    </TableCell>
                                    <TableCell className="text-sm">{outlet.kecamatan}, {outlet.kabupaten}</TableCell>
                                    <TableCell className="text-sm">{outlet.ownerName || "-"}<br /><span className="text-xs text-muted-foreground">{outlet.ownerPhone}</span></TableCell>
                                    <TableCell>{outlet.status}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Link href={`/mitra/o/${outlet.publicToken}`} target="_blank" className="rounded-md border p-2" title="Profil publik">
                                                <ExternalLink className="h-4 w-4" />
                                            </Link>
                                            <button onClick={() => openEdit(outlet.id)} className="rounded-md border p-2" title="Edit outlet" aria-label="Edit outlet">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <Link href={`/api/public/mitra/outlets/${outlet.publicToken}/qr`} target="_blank" className="rounded-md border p-2" title="QR SVG">
                                                <QrCode className="h-4 w-4" />
                                            </Link>
                                            <Link href={`/api/public/mitra/outlets/${outlet.publicToken}/qr?format=card`} target="_blank" className="rounded-md border p-2" title="Kartu QR 90 x 55 mm">
                                                <Download className="h-4 w-4" />
                                            </Link>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Belum ada outlet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}
