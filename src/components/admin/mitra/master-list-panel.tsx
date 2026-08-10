"use client";

import React from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type MasterType = "tap" | "kabupaten" | "kecamatan";

interface MasterRow {
    id: string;
    name: string;
    outletCount: number;
}

/**
 * Daftar master wilayah. Nilainya hanya nama, jadi satu komponen melayani ketiga jenis
 * (TAP, Kabupaten, Kecamatan) -- membuat tiga komponen kembar hanya akan menggandakan
 * kode yang sama.
 */
export function MasterListPanel({ type, label }: { type: MasterType; label: string }) {
    const [rows, setRows] = React.useState<MasterRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [nama, setNama] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [editId, setEditId] = React.useState("");
    const [editNama, setEditNama] = React.useState("");
    const [filter, setFilter] = React.useState("");

    const load = React.useCallback(() => {
        setLoading(true);
        fetch(`/api/admin/mitra/master?type=${type}`)
            .then((res) => res.json())
            .then((data) => setRows(Array.isArray(data.rows) ? data.rows : []))
            .finally(() => setLoading(false));
    }, [type]);

    React.useEffect(() => { load(); }, [load]);

    const tambah = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!nama.trim()) return;
        setSaving(true);
        const res = await fetch("/api/admin/mitra/master", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, name: nama.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        setSaving(false);
        if (!res.ok) return alert(data.error || "Gagal menambah data");
        setNama("");
        load();
    };

    const simpanEdit = async (id: string) => {
        if (!editNama.trim()) return;
        const res = await fetch("/api/admin/mitra/master", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, id, name: editNama.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || "Gagal menyimpan");
        setEditId("");
        load();
    };

    const hapus = async (row: MasterRow) => {
        const catatan = row.outletCount > 0
            ? `\n\n${row.outletCount} outlet masih memakai nama ini. Datanya tidak ikut berubah, tetapi "${row.name}" tidak lagi muncul sebagai pilihan.`
            : "";
        if (!confirm(`Hapus ${label} "${row.name}"?${catatan}`)) return;
        const res = await fetch(`/api/admin/mitra/master?type=${type}&id=${row.id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return alert(data.error || "Gagal menghapus");
        }
        load();
    };

    const tampil = rows.filter((row) => row.name.toLowerCase().includes(filter.trim().toLowerCase()));

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-5">
                    <form onSubmit={tambah} className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 space-y-1">
                            <label className="text-sm font-medium">Tambah {label}</label>
                            <Input value={nama} onChange={(event) => setNama(event.target.value)} placeholder={`Nama ${label.toLowerCase()}`} />
                        </div>
                        <Button disabled={saving || !nama.trim()}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah
                        </Button>
                    </form>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Daftar ini mengisi pilihan {label} di form outlet dan salesforce. Mengganti nama di sini
                        ikut memperbarui outlet yang sudah memakainya, supaya tidak ada data yang tertinggal
                        menunjuk nama lama.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="space-y-3 p-5">
                    <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`Cari ${label.toLowerCase()}...`} className="max-w-sm" />
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{label}</TableHead>
                                <TableHead>Dipakai Outlet</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                            ) : tampil.length ? tampil.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        {editId === row.id ? (
                                            <Input value={editNama} onChange={(event) => setEditNama(event.target.value)} className="max-w-xs" />
                                        ) : (
                                            <span className="font-medium">{row.name}</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{row.outletCount}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {editId === row.id ? (
                                                <>
                                                    <Button variant="outline" size="sm" onClick={() => simpanEdit(row.id)}><Check className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setEditId("")}><X className="h-4 w-4" /></Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button variant="outline" size="sm" onClick={() => { setEditId(row.id); setEditNama(row.name); }}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => hapus(row)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Belum ada data {label.toLowerCase()}.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
