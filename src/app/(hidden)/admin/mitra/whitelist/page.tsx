"use client";

import React from "react";
import { KeyRound, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface WhitelistRow {
    id: string;
    phoneE164: string;
    name?: string;
    scope: "ALL" | "OUTLET" | "TERRITORY";
    outletName?: string;
    territoryName?: string;
    isActive: boolean;
}

interface OptionRow {
    id: string;
    name: string;
    outletCode?: string;
}

export default function AdminMitraWhitelistPage() {
    const [rows, setRows] = React.useState<WhitelistRow[]>([]);
    const [outlets, setOutlets] = React.useState<OptionRow[]>([]);
    const [territories, setTerritories] = React.useState<OptionRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [form, setForm] = React.useState({ phone: "", name: "", scope: "ALL", outletId: "", territoryId: "" });

    const load = React.useCallback(() => {
        setLoading(true);
        fetch("/api/admin/mitra/whitelist")
            .then((res) => res.json())
            .then((data) => {
                setRows(Array.isArray(data.whitelist) ? data.whitelist : []);
                setOutlets(Array.isArray(data.outlets) ? data.outlets : []);
                setTerritories(Array.isArray(data.territories) ? data.territories : []);
            })
            .finally(() => setLoading(false));
    }, []);

    React.useEffect(() => { load(); }, [load]);

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        const res = await fetch("/api/admin/mitra/whitelist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setForm({ phone: "", name: "", scope: "ALL", outletId: "", territoryId: "" });
            load();
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal menyimpan whitelist");
        }
        setSaving(false);
    };

    const toggle = async (row: WhitelistRow) => {
        await fetch(`/api/admin/mitra/whitelist/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !row.isActive }),
        });
        load();
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Whitelist OTP</h1>
                <p className="mt-1 text-sm text-muted-foreground">Nomor yang diizinkan membuka detail outlet lewat OTP WhatsApp.</p>
            </div>

            <Card>
                <CardContent className="p-5">
                    <form onSubmit={save} className="grid gap-3 md:grid-cols-6">
                        <div className="space-y-2 md:col-span-2">
                            <Label>Nomor WhatsApp</Label>
                            <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="08xxxxxxxxxx" />
                        </div>
                        <div className="space-y-2">
                            <Label>Nama</Label>
                            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Scope</Label>
                            <select value={form.scope} onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value, outletId: "", territoryId: "" }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                <option value="ALL">ALL</option>
                                <option value="OUTLET">OUTLET</option>
                                <option value="TERRITORY">TERRITORY</option>
                            </select>
                        </div>
                        {form.scope === "OUTLET" ? (
                            <div className="space-y-2">
                                <Label>Outlet</Label>
                                <select value={form.outletId} onChange={(event) => setForm((prev) => ({ ...prev, outletId: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="">Pilih outlet</option>
                                    {outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                                </select>
                            </div>
                        ) : form.scope === "TERRITORY" ? (
                            <div className="space-y-2">
                                <Label>Territory</Label>
                                <select value={form.territoryId} onChange={(event) => setForm((prev) => ({ ...prev, territoryId: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="">Pilih wilayah</option>
                                    {territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
                                </select>
                            </div>
                        ) : <div />}
                        <div className="flex items-end">
                            <Button disabled={saving} className="w-full">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Tambah
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nomor</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                            ) : rows.length ? rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="font-semibold">{row.phoneE164}</TableCell>
                                    <TableCell>{row.name || "-"}</TableCell>
                                    <TableCell>
                                        <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
                                            <KeyRound className="h-3 w-3" />
                                            {row.scope} {row.outletName || row.territoryName || ""}
                                        </div>
                                    </TableCell>
                                    <TableCell>{row.isActive ? "Aktif" : "Nonaktif"}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => toggle(row)}>
                                            {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Belum ada whitelist.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
