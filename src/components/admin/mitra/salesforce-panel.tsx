"use client";

import Image from "next/image";
import React from "react";
import { ImageIcon, Loader2, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TombolUrut } from "@/components/ui/sortable-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { urutkanBaris, useUrutTabel } from "@/lib/use-sort";

interface Salesforce {
    id: string;
    name: string;
    photoUrl: string | null;
    phone: string | null;
    tap: string;
    isActive: boolean;
    outletCount: number;
}

const KOSONG = { id: "", name: "", photoUrl: "", phone: "", tap: "", isActive: true };

export function SalesforcePanel() {
    const [rows, setRows] = React.useState<Salesforce[]>([]);
    const [q, setQ] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [form, setForm] = React.useState(KOSONG);
    // Form edit berada di atas tabel, jadi menekan Edit pada baris yang jauh di bawah
    // tampak seperti tidak terjadi apa-apa. Halaman digulirkan ke formulirnya.
    const formRef = React.useRef<HTMLDivElement>(null);
    const { urut, gantiUrut } = useUrutTabel<string>("");

    const load = React.useCallback(() => {
        setLoading(true);
        fetch(`/api/admin/mitra/salesforce?q=${encodeURIComponent(q)}`)
            .then((res) => res.json())
            .then((data) => setRows(Array.isArray(data.salesforces) ? data.salesforces : []))
            .finally(() => setLoading(false));
    }, [q]);

    React.useEffect(() => { load(); }, [load]);

    const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.url) setForm((previous) => ({ ...previous, photoUrl: data.url }));
            else alert(data.error || "Gagal upload foto salesforce");
        } finally {
            setUploading(false);
            // Input direset supaya file yang sama bisa dipilih ulang setelah gagal upload.
            event.target.value = "";
        }
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        const res = await fetch("/api/admin/mitra/salesforce", {
            method: form.id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        const data = await res.json().catch(() => ({}));
        setSaving(false);
        if (!res.ok) return alert(data.error || "Gagal menyimpan salesforce");
        setForm(KOSONG);
        load();
    };

    const remove = async (row: Salesforce) => {
        const peringatan = row.outletCount > 0
            ? `Hapus ${row.name}? ${row.outletCount} outlet akan kehilangan penautan salesforce-nya (data outletnya sendiri tetap aman).`
            : `Hapus ${row.name}?`;
        if (!window.confirm(peringatan)) return;

        const res = await fetch(`/api/admin/mitra/salesforce?id=${row.id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return alert(data.error || "Gagal menghapus salesforce");
        }
        if (form.id === row.id) setForm(KOSONG);
        load();
    };

    const startEdit = (row: Salesforce) => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setForm({
            id: row.id,
            name: row.name,
            photoUrl: row.photoUrl || "",
            phone: row.phone || "",
            tap: row.tap || "",
            isActive: row.isActive,
        });
    };

    const rowsTampil = urutkanBaris(rows, urut, (row, kolom) => {
        if (kolom === "salesforce") return row.name;
        if (kolom === "tap") return row.tap;
        if (kolom === "whatsapp") return row.phone || "";
        if (kolom === "outlet") return row.outletCount;
        if (kolom === "status") return row.isActive ? 1 : 0;
        return "";
    });

    return (
        <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
                Master nama dan foto salesforce. Outlet menautkannya, jadi ganti nama atau foto di sini
                langsung berlaku di seluruh profil outlet yang bersangkutan.
            </p>

            <Card ref={formRef} className="scroll-mt-20">
                <CardContent className="p-5">
                    <form onSubmit={save} className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label>Nama Salesforce</Label>
                                <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Aditia" />
                            </div>
                            <div className="space-y-2">
                                <Label>TAP</Label>
                                <Input value={form.tap} onChange={(event) => setForm((prev) => ({ ...prev, tap: event.target.value }))} placeholder="Kuningan" />
                            </div>
                            <div className="space-y-2">
                                <Label>Nomor WhatsApp</Label>
                                <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="08xxxxxxxxxx" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Foto</Label>
                            <div className="flex items-center gap-3">
                                {form.photoUrl ? (
                                    <Image src={form.photoUrl} alt="Foto salesforce" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full border object-cover" unoptimized />
                                ) : (
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border bg-gray-50 text-muted-foreground">
                                        <ImageIcon className="h-4 w-4" />
                                    </span>
                                )}
                                <Input type="file" accept="image/*" onChange={uploadPhoto} disabled={uploading} className="max-w-sm" />
                                {form.photoUrl && (
                                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, photoUrl: "" }))} className="text-xs font-semibold text-red-600">
                                        Hapus foto
                                    </button>
                                )}
                            </div>
                            {uploading && <p className="text-xs text-muted-foreground">Mengunggah foto...</p>}
                        </div>

                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="h-4 w-4 accent-red-600"
                                checked={form.isActive}
                                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                            />
                            Aktif
                        </label>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button disabled={saving || !form.name.trim()}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : form.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {form.id ? "Simpan Perubahan" : "Tambah Salesforce"}
                            </Button>
                            {form.id && (
                                <Button type="button" variant="ghost" onClick={() => setForm(KOSONG)}>
                                    <X className="h-4 w-4" />
                                    Batal edit
                                </Button>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5">
                    <div className="mb-4 flex gap-2">
                        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari nama atau TAP" />
                        <Button onClick={load} size="icon" aria-label="Cari">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead><TombolUrut kolom="salesforce" label="Salesforce" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="tap" label="TAP" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="whatsapp" label="WhatsApp" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead className="text-right"><TombolUrut kolom="outlet" label="Outlet" urut={urut} onKlik={gantiUrut} kanan /></TableHead>
                                <TableHead><TombolUrut kolom="status" label="Status" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                            ) : rowsTampil.length ? rowsTampil.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {row.photoUrl ? (
                                                <Image src={row.photoUrl} alt={row.name} width={36} height={36} className="h-9 w-9 shrink-0 rounded-full border object-cover" unoptimized />
                                            ) : (
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-gray-50 text-xs font-bold text-muted-foreground">
                                                    {row.name.slice(0, 1).toUpperCase()}
                                                </span>
                                            )}
                                            <span className="font-semibold">{row.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{row.tap || "-"}</TableCell>
                                    <TableCell className="text-sm">{row.phone || "-"}</TableCell>
                                    <TableCell className="text-right tabular-nums">{row.outletCount}</TableCell>
                                    <TableCell className="text-sm">{row.isActive ? "Aktif" : "Nonaktif"}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <button onClick={() => startEdit(row)} className="rounded-md border p-2" title="Edit" aria-label="Edit salesforce">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => remove(row)} className="rounded-md border p-2" title="Hapus" aria-label="Hapus salesforce">
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Belum ada salesforce.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
