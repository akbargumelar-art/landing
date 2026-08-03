"use client";

import React from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Batch {
    id: string;
    type: string;
    fileName: string;
    rowCount: number;
    status: string;
    createdAt: string;
}

export default function AdminMitraImportPage() {
    const [type, setType] = React.useState("whitelist");
    const [file, setFile] = React.useState<File | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [result, setResult] = React.useState<{ rows?: unknown[]; errors?: { row: number; message: string }[]; rowCount?: number; imported?: number } | null>(null);
    const [batches, setBatches] = React.useState<Batch[]>([]);

    const load = React.useCallback(() => {
        fetch("/api/admin/mitra/imports")
            .then((res) => res.json())
            .then((data) => setBatches(Array.isArray(data.batches) ? data.batches : []));
    }, []);

    React.useEffect(() => { load(); }, [load]);

    const submit = async (mode: "preview" | "commit") => {
        if (!file) return;
        setLoading(true);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", type);
        fd.append("mode", mode);
        const res = await fetch("/api/admin/mitra/imports", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        setResult(data);
        if (res.ok && mode === "commit") load();
        setLoading(false);
    };

    const rollback = async (batchId: string) => {
        const res = await fetch("/api/admin/mitra/imports", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ batchId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) alert(data.error || "Rollback gagal");
        load();
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Import Data Mitra</h1>
                <p className="mt-1 text-sm text-muted-foreground">Preview dan validasi import whitelist, performance, dan program score.</p>
            </div>

            <Card>
                <CardContent className="grid gap-4 p-5 md:grid-cols-4">
                    <div className="space-y-2">
                        <Label>Tipe Import</Label>
                        <select value={type} onChange={(event) => setType(event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
                            <option value="whitelist">Whitelist</option>
                            <option value="performance">Performance</option>
                            <option value="program_score">Program Score</option>
                        </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label>File Excel/CSV</Label>
                        <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block h-10 w-full rounded-md border px-3 py-2 text-sm" />
                    </div>
                    <div className="flex items-end gap-2">
                        <Button variant="outline" onClick={() => submit("preview")} disabled={!file || loading} className="flex-1">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                            Preview
                        </Button>
                        <Button onClick={() => submit("commit")} disabled={!file || loading} className="flex-1">
                            <Upload className="h-4 w-4" />
                            Commit
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {result && (
                <Card>
                    <CardContent className="p-5">
                        <h2 className="font-bold">Hasil Validasi</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Rows: {result.rowCount ?? "-"} | Imported: {result.imported ?? 0} | Errors: {result.errors?.length || 0}</p>
                        {result.errors && result.errors.length > 0 && (
                            <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                                {result.errors.slice(0, 20).map((error) => <p key={`${error.row}-${error.message}`}>Baris {error.row}: {error.message}</p>)}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-5">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>File</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead>Rows</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {batches.length ? batches.map((batch) => (
                                <TableRow key={batch.id}>
                                    <TableCell><p className="font-semibold">{batch.fileName}</p><p className="text-xs text-muted-foreground">{new Date(batch.createdAt).toLocaleString("id-ID")}</p></TableCell>
                                    <TableCell>{batch.type}</TableCell>
                                    <TableCell>{batch.rowCount}</TableCell>
                                    <TableCell>{batch.status}</TableCell>
                                    <TableCell className="text-right">
                                        {batch.type === "whitelist" && batch.status === "COMPLETED" && (
                                            <Button variant="outline" size="sm" onClick={() => rollback(batch.id)}>Rollback</Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Belum ada riwayat import.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
