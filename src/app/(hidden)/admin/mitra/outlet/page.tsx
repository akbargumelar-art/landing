"use client";

import Link from "next/link";
import React from "react";
import { Download, ExternalLink, Loader2, Pencil, Plus, QrCode, Save, Search, Trash2, X } from "lucide-react";

import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MITRA_DETAIL_FIELD_GROUPS } from "@/lib/mitra-fields";
import { MITRA_PHOTO_SLOTS, statusFoto } from "@/lib/mitra-outlet-photos";
import {
    DEFAULT_OUTLET_BRANDING,
    DEFAULT_OUTLET_CATEGORY,
    DEFAULT_PJP_DAY,
    DEFAULT_PJP_TYPE,
    OUTLET_BRANDINGS,
    OUTLET_CATEGORIES,
    PJP_DAYS,
    PJP_TYPES,
    buildOutletMapsUrl,
} from "@/lib/mitra-outlet-options";

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
}

interface EditLog {
    id: string;
    action: "PHOTO" | "LOCATION";
    actorType: "MITRA" | "ADMIN";
    actorLabel: string;
    createdAt: string;
}

interface SalesforceOption {
    id: string;
    name: string;
    isActive: boolean;
}

export default function AdminMitraOutletPage() {
    const [outlets, setOutlets] = React.useState<Outlet[]>([]);
    const [salesforces, setSalesforces] = React.useState<SalesforceOption[]>([]);
    const [q, setQ] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [editOutlet, setEditOutlet] = React.useState<Record<string, unknown> | null>(null);
    const [editDetails, setEditDetails] = React.useState<Record<string, Record<string, string | number>>>({});
    const [editSaving, setEditSaving] = React.useState(false);
    const [editLogs, setEditLogs] = React.useState<EditLog[]>([]);
    const editRef = React.useRef<HTMLDivElement>(null);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [deleting, setDeleting] = React.useState(false);
    const [form, setForm] = React.useState({
        outletCode: "",
        name: "",
        ownerName: "",
        ownerPhone: "",
        kabupaten: "",
        kecamatan: "",
        category: String(DEFAULT_OUTLET_CATEGORY),
        pjpDay: String(DEFAULT_PJP_DAY),
        pjpType: String(DEFAULT_PJP_TYPE),
        branding: String(DEFAULT_OUTLET_BRANDING),
        salesforceId: "",
    });

    const load = React.useCallback(() => {
        setLoading(true);
        setSelectedIds([]);
        fetch(`/api/admin/mitra/outlets?q=${encodeURIComponent(q)}&pageSize=50`)
            .then((res) => res.json())
            .then((data) => {
                setOutlets(Array.isArray(data.outlets) ? data.outlets : []);
                setSalesforces(Array.isArray(data.salesforces) ? data.salesforces : []);
            })
            .finally(() => setLoading(false));
    }, [q]);

    React.useEffect(() => { load(); }, [load]);

    /**
     * Panel edit dirender di atas tabel dan baru ada setelah datanya dimuat, jadi
     * penggulirannya harus lewat effect -- di dalam handler klik ref-nya masih null.
     *
     * Dibandingkan dengan id yang sebelumnya terbuka, bukan sekadar "editOutlet terisi":
     * mengetik di form ikut mengganti objek editOutlet, dan tanpa perbandingan ini
     * halaman akan melompat ke atas pada setiap ketikan.
     */
    const idTerbukaRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        const id = editOutlet ? String(editOutlet.id) : null;
        if (id && id !== idTerbukaRef.current) {
            editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        idTerbukaRef.current = id;
    }, [editOutlet]);

    const toggleSelected = (id: string) => {
        setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    };

    const deleteOne = async (outlet: Outlet) => {
        if (!window.confirm(`Hapus outlet ${outlet.name} (${outlet.outletCode})? Data detail, performa, dan keikutsertaan program outlet ini ikut terhapus permanen.`)) return;
        const res = await fetch(`/api/admin/mitra/outlets/${outlet.id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal menghapus outlet.");
            return;
        }
        load();
    };

    const deleteSelected = async () => {
        if (!window.confirm(`Hapus ${selectedIds.length} outlet terpilih? Data detail, performa, dan keikutsertaan program outlet tersebut ikut terhapus permanen.`)) return;
        setDeleting(true);
        const res = await fetch("/api/admin/mitra/outlets", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: selectedIds }),
        });
        setDeleting(false);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal menghapus outlet.");
            return;
        }
        load();
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        const res = await fetch("/api/admin/mitra/outlets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setForm({
                outletCode: "", name: "", ownerName: "", ownerPhone: "", kabupaten: "", kecamatan: "",
                category: String(DEFAULT_OUTLET_CATEGORY), pjpDay: String(DEFAULT_PJP_DAY),
                pjpType: String(DEFAULT_PJP_TYPE), branding: String(DEFAULT_OUTLET_BRANDING),
                salesforceId: "",
            });
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
        setEditLogs(Array.isArray(data.editLogs) ? data.editLogs : []);
        setEditDetails({
            sellthruDigiposJson: data.details?.sellthruDigiposJson || {},
            sellthruNotaJson: data.details?.sellthruNotaJson || {},
            rechargeDigiposJson: data.details?.rechargeDigiposJson || {},
        });
    };

    const updateEditField = (key: string, value: string) => {
        setEditOutlet((previous) => previous ? { ...previous, [key]: value } : previous);
    };

    // Pratinjau tautan lokasi mengikuti koordinat yang sedang diketik, sama seperti
    // yang nanti disimpan server.
    const mapsPreview = editOutlet
        ? buildOutletMapsUrl(Number(editOutlet.latitude), Number(editOutlet.longitude))
        : "";

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
            <BackLink href="/admin/mitra" label="Kembali ke Database Mitra Outlet" />

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
                            <Label>Kategori Outlet</Label>
                            <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                {OUTLET_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Hari PJP</Label>
                            <select value={form.pjpDay} onChange={(event) => setForm((prev) => ({ ...prev, pjpDay: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                {PJP_DAYS.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tipe PJP</Label>
                            <select value={form.pjpType} onChange={(event) => setForm((prev) => ({ ...prev, pjpType: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                {PJP_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Branding Outlet</Label>
                            <select value={form.branding} onChange={(event) => setForm((prev) => ({ ...prev, branding: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                {OUTLET_BRANDINGS.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Salesforce</Label>
                            <select value={form.salesforceId} onChange={(event) => setForm((prev) => ({ ...prev, salesforceId: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                <option value="">Tanpa salesforce</option>
                                {salesforces.filter((item) => item.isActive).map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
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
                <Card ref={editRef} className="scroll-mt-20">
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
                                ["outletCode", "ID Digipos"], ["rsNumber", "Nomor RS"], ["name", "Nama Outlet"], ["ownerName", "Nama Owner"],
                                ["ownerPhone", "Nomor Owner"], ["tap", "TAP (nama cabang)"], ["kabupaten", "Kabupaten"],
                                ["kecamatan", "Kecamatan"], ["longitude", "Longitude"], ["latitude", "Latitude"], ["photoUrl", "URL Foto"],
                            ].map(([key, label]) => (
                                <Field key={key} label={label} value={String(editOutlet[key] ?? "")} onChange={(value) => updateEditField(key, value)} />
                            ))}
                            {/* Salesforce kini master tersendiri: nama dan fotonya diurus di
                                menu Salesforce, outlet tinggal menautkannya. Foto tidak lagi
                                diunggah per outlet supaya tidak ada dua sumber kebenaran. */}
                            <div className="space-y-2">
                                <Label>Salesforce</Label>
                                <select
                                    value={String(editOutlet.salesforceId || "")}
                                    onChange={(event) => updateEditField("salesforceId", event.target.value)}
                                    className="h-10 w-full rounded-md border px-3 text-sm"
                                >
                                    <option value="">Tanpa salesforce</option>
                                    {salesforces
                                        .filter((item) => item.isActive || item.id === editOutlet.salesforceId)
                                        .map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}{item.isActive ? "" : " (nonaktif)"}
                                            </option>
                                        ))}
                                </select>
                                <Link href="/admin/mitra/salesforce" className="text-xs font-semibold text-red-600 hover:underline">
                                    Kelola nama & foto salesforce
                                </Link>
                            </div>
                            <div className="space-y-2">
                                <Label>Kategori Outlet</Label>
                                <select value={String(editOutlet.category || DEFAULT_OUTLET_CATEGORY)} onChange={(event) => updateEditField("category", event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
                                    {OUTLET_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Hari PJP</Label>
                                <select value={String(editOutlet.pjpDay || DEFAULT_PJP_DAY)} onChange={(event) => updateEditField("pjpDay", event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
                                    {PJP_DAYS.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Tipe PJP</Label>
                                <select value={String(editOutlet.pjpType || DEFAULT_PJP_TYPE)} onChange={(event) => updateEditField("pjpType", event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
                                    {PJP_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                                <p className="text-xs text-muted-foreground">Jumlah kunjungan wajib salesforce per bulan.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Branding Outlet</Label>
                                <select value={String(editOutlet.branding || DEFAULT_OUTLET_BRANDING)} onChange={(event) => updateEditField("branding", event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
                                    {OUTLET_BRANDINGS.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <select value={String(editOutlet.status || "ACTIVE")} onChange={(event) => updateEditField("status", event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="SUSPENDED">SUSPENDED</option>
                                </select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Lokasi (Google Maps)</Label>
                                {mapsPreview ? (
                                    <a href={mapsPreview} target="_blank" rel="noreferrer" className="block truncate text-sm text-blue-600 underline">
                                        {mapsPreview}
                                    </a>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Isi Longitude dan Latitude untuk membuat tautan otomatis.</p>
                                )}
                                <p className="text-xs text-muted-foreground">Dibuat otomatis dari koordinat, tidak perlu diketik.</p>
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

                        {/* Foto hanya bisa diunggah mitra lewat halaman detail (wajib OTP),
                            jadi di sini statusnya ditampilkan untuk dipantau, bukan diedit.
                            Kebaruannya adalah bukti kunjungan salesforce mingguan. */}
                        <div className="rounded-lg border bg-gray-50 p-4">
                            <h3 className="font-bold">Status Foto Outlet</h3>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {MITRA_PHOTO_SLOTS.map((slot) => {
                                    const url = editOutlet[slot.urlColumn];
                                    const status = statusFoto(editOutlet[slot.atColumn] as string | null);
                                    return (
                                        <div key={slot.key} className="rounded-lg border bg-white p-3">
                                            <p className="text-xs font-bold text-gray-950">{slot.label}</p>
                                            <p className={`mt-1 text-xs font-semibold ${status.perluDiperbarui ? "text-amber-700" : "text-green-700"}`}>
                                                {status.label}
                                            </p>
                                            {url ? (
                                                <a href={String(url)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-red-600 hover:underline">
                                                    Lihat foto
                                                </a>
                                            ) : (
                                                <p className="mt-1 text-xs text-muted-foreground">Belum ada foto</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Riwayat ini sumbernya sama dengan yang dilihat mitra di halaman
                            detail, jadi admin dan mitra membaca jejak yang persis sama. */}
                        <details className="rounded-lg border bg-gray-50 p-4">
                            <summary className="cursor-pointer font-bold">
                                Riwayat Perubahan Foto &amp; Lokasi ({editLogs.length})
                            </summary>
                            {editLogs.length > 0 ? (
                                <ul className="mt-4 space-y-2">
                                    {editLogs.map((log) => (
                                        <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-4 py-2 text-sm">
                                            <span>
                                                <span className="font-semibold">
                                                    {log.action === "PHOTO" ? "Foto diperbarui" : "Lokasi diperbarui"}
                                                </span>
                                                <span className="ml-2 text-muted-foreground">
                                                    oleh {log.actorLabel} ({log.actorType === "ADMIN" ? "admin" : "mitra"})
                                                </span>
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(log.createdAt))}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-4 text-sm text-muted-foreground">Belum ada perubahan yang tercatat.</p>
                            )}
                        </details>

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

                    {selectedIds.length > 0 && (
                        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                            <span className="text-sm font-semibold text-red-700">{selectedIds.length} outlet dipilih</span>
                            <Button variant="outline" size="sm" onClick={deleteSelected} disabled={deleting}>
                                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4 text-red-600" />}
                                Hapus terpilih
                            </Button>
                        </div>
                    )}

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <input
                                        type="checkbox"
                                        aria-label="Pilih semua outlet"
                                        className="h-4 w-4 accent-red-600"
                                        checked={outlets.length > 0 && selectedIds.length === outlets.length}
                                        onChange={(event) => setSelectedIds(event.target.checked ? outlets.map((outlet) => outlet.id) : [])}
                                    />
                                </TableHead>
                                <TableHead>Outlet</TableHead>
                                <TableHead>Wilayah</TableHead>
                                <TableHead>Owner</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                            ) : outlets.length ? outlets.map((outlet) => (
                                <TableRow key={outlet.id}>
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            aria-label={`Pilih ${outlet.name}`}
                                            className="h-4 w-4 accent-red-600"
                                            checked={selectedIds.includes(outlet.id)}
                                            onChange={() => toggleSelected(outlet.id)}
                                        />
                                    </TableCell>
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
                                            <button onClick={() => deleteOne(outlet)} className="rounded-md border p-2" title="Hapus outlet" aria-label="Hapus outlet">
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Belum ada outlet.</TableCell></TableRow>
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
