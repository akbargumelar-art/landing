"use client";

import React from "react";
import { KeyRound, Loader2, Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const emptyForm = { phone: "", name: "", scope: "ALL", outletId: "", territoryId: "" };

export function WhitelistOtpSettings() {
    const [rows, setRows] = React.useState<WhitelistRow[]>([]);
    const [outlets, setOutlets] = React.useState<OptionRow[]>([]);
    const [territories, setTerritories] = React.useState<OptionRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [forbidden, setForbidden] = React.useState(false);
    const [message, setMessage] = React.useState("");
    const [form, setForm] = React.useState(emptyForm);
    const [bulkMode, setBulkMode] = React.useState(false);
    const [bulkText, setBulkText] = React.useState("");
    const [canEdit, setCanEdit] = React.useState(false);

    React.useEffect(() => {
        fetch("/api/admin/me")
            .then((res) => res.ok ? res.json() : null)
            .then((data) => setCanEdit(data?.session?.role === "SUPER_ADMIN"))
            .catch(() => setCanEdit(false));
    }, []);

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/mitra/whitelist");
            if (response.status === 403) {
                setForbidden(true);
                return;
            }
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Whitelist gagal dimuat.");
            setRows(Array.isArray(data.whitelist) ? data.whitelist : []);
            setOutlets(Array.isArray(data.outlets) ? data.outlets : []);
            setTerritories(Array.isArray(data.territories) ? data.territories : []);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Whitelist gagal dimuat.");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { load(); }, [load]);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setMessage("");

        const payload = bulkMode
            ? { phones: bulkText, scope: form.scope, outletId: form.outletId, territoryId: form.territoryId }
            : form;

        try {
            const response = await fetch("/api/admin/mitra/whitelist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Gagal menyimpan whitelist.");

            if (bulkMode) {
                const parts = [`${data.added} nomor ditambahkan`];
                if (data.skippedExisting > 0) parts.push(`${data.skippedExisting} sudah terdaftar`);
                if (Array.isArray(data.invalid) && data.invalid.length > 0) parts.push(`${data.invalid.length} tidak valid`);
                setMessage(parts.join(", ") + ".");
                setBulkText("");
            } else {
                setForm(emptyForm);
            }
            await load();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Gagal menyimpan whitelist.");
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(row: WhitelistRow) {
        await fetch(`/api/admin/mitra/whitelist/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !row.isActive }),
        });
        load();
    }

    async function remove(row: WhitelistRow) {
        if (!window.confirm(`Hapus ${row.phoneE164} dari whitelist OTP?`)) return;
        const response = await fetch(`/api/admin/mitra/whitelist/${row.id}`, { method: "DELETE" });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setMessage(data.error || "Gagal menghapus whitelist.");
            return;
        }
        load();
    }

    if (forbidden) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <KeyRound className="h-5 w-5" /> Whitelist Penerima OTP
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Nomor WhatsApp yang diizinkan membuka detail performa outlet lewat OTP.
                    Nomor di luar daftar ini tidak akan menerima kode OTP.
                </p>

                {canEdit && (
                <div className="flex gap-2">
                    <Button type="button" variant={bulkMode ? "outline" : "default"} size="sm" onClick={() => { setBulkMode(false); setMessage(""); }}>
                        Tambah satuan
                    </Button>
                    <Button type="button" variant={bulkMode ? "default" : "outline"} size="sm" onClick={() => { setBulkMode(true); setMessage(""); }}>
                        <Users className="mr-2 h-4 w-4" /> Tambah bulk
                    </Button>
                </div>
                )}

                {canEdit && (
                <form onSubmit={submit} className="grid gap-3 md:grid-cols-6">
                    {bulkMode ? (
                        <div className="space-y-2 md:col-span-3">
                            <Label htmlFor="wl-bulk">Daftar nomor WhatsApp</Label>
                            <textarea
                                id="wl-bulk"
                                required
                                value={bulkText}
                                onChange={(event) => setBulkText(event.target.value)}
                                placeholder={"08123456789\n08987654321"}
                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <p className="text-xs text-muted-foreground">Satu nomor per baris, atau dipisah koma. Nomor yang sudah terdaftar dilewati.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="wl-phone">Nomor WhatsApp</Label>
                                <Input id="wl-phone" required value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="08xxxxxxxxxx" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="wl-name">Nama</Label>
                                <Input id="wl-name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                            </div>
                        </>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="wl-scope">Scope</Label>
                        <select
                            id="wl-scope"
                            value={form.scope}
                            onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value, outletId: "", territoryId: "" }))}
                            className="h-10 w-full rounded-md border px-3 text-sm"
                        >
                            <option value="ALL">Semua outlet</option>
                            <option value="OUTLET">Outlet tertentu</option>
                            <option value="TERRITORY">Wilayah tertentu</option>
                        </select>
                    </div>

                    {form.scope === "OUTLET" ? (
                        <div className="space-y-2">
                            <Label htmlFor="wl-outlet">Outlet</Label>
                            <select id="wl-outlet" required value={form.outletId} onChange={(event) => setForm((prev) => ({ ...prev, outletId: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                <option value="">Pilih outlet</option>
                                {outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                            </select>
                        </div>
                    ) : form.scope === "TERRITORY" ? (
                        <div className="space-y-2">
                            <Label htmlFor="wl-territory">Wilayah</Label>
                            <select id="wl-territory" required value={form.territoryId} onChange={(event) => setForm((prev) => ({ ...prev, territoryId: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                <option value="">Pilih wilayah</option>
                                {territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
                            </select>
                        </div>
                    ) : <div />}

                    <div className="flex items-end">
                        <Button type="submit" disabled={saving} className="w-full">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Tambah
                        </Button>
                    </div>
                </form>
                )}

                {message && <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</p>}

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nomor</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead>Status</TableHead>
                                {canEdit && <TableHead className="text-right">Aksi</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={canEdit ? 5 : 4} className="h-24 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                            ) : rows.length ? rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="font-semibold whitespace-nowrap">{row.phoneE164}</TableCell>
                                    <TableCell>{row.name || "-"}</TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold">
                                            {row.scope === "ALL" ? "Semua outlet" : row.outletName || row.territoryName || row.scope}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                            {row.isActive ? "Aktif" : "Nonaktif"}
                                        </span>
                                    </TableCell>
                                    {canEdit && (
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => toggleActive(row)}>
                                                {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => remove(row)} title="Hapus nomor">
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    )}
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={canEdit ? 5 : 4} className="h-24 text-center text-muted-foreground">Belum ada nomor di whitelist.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
