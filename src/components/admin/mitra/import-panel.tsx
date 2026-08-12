"use client";

import React from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ImportResult {
    rowCount?: number;
    imported?: number;
    errors?: { row: number; message: string }[];
    ringkasan?: { tambah: number; perbarui: number } | null;
}

/**
 * Panel unggah berkas yang menempel pada halaman datanya sendiri. Sebelumnya seluruh
 * unggahan dikumpulkan di satu layar dengan dropdown tipe, sehingga admin harus tahu
 * lebih dulu tipe mana yang cocok untuk data yang sedang ia kerjakan.
 */
export function ImportPanel({
    type,
    title,
    description,
    onCommitted,
}: {
    type: "whitelist" | "performance" | "outlet" | "outlet_detail";
    title: string;
    description: string;
    onCommitted?: () => void;
}) {
    const [file, setFile] = React.useState<File | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [result, setResult] = React.useState<ImportResult | null>(null);

    const submit = async (mode: "preview" | "commit") => {
        if (!file) return;
        setLoading(true);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", type);
        fd.append("mode", mode);
        const res = await fetch("/api/admin/mitra/imports", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        setLoading(false);
        setResult(data);
        if (res.ok && mode === "commit") onCommitted?.();
    };

    return (
        <Card>
            <CardContent className="space-y-3 p-5">
                <div>
                    <h2 className="font-bold">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(`/api/admin/mitra/imports/template?type=${type}`, "_blank")}>
                        <Download className="h-4 w-4" /> Unduh Template
                    </Button>
                    <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(event) => { setFile(event.target.files?.[0] || null); setResult(null); }}
                        className="block h-10 flex-1 rounded-md border px-3 py-2 text-sm"
                    />
                    <Button variant="outline" size="sm" disabled={!file || loading} onClick={() => submit("preview")}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Periksa
                    </Button>
                    <Button size="sm" disabled={!file || loading} onClick={() => submit("commit")}>
                        <Upload className="h-4 w-4" /> Simpan
                    </Button>
                </div>

                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Baris yang cocok dengan data lama <strong>diperbarui</strong>, bukan digandakan. Sel yang
                    dikosongkan dibiarkan apa adanya — mengosongkan sel tidak menghapus isi di database.
                </p>

                {result && (
                    <div className="rounded-md border p-3 text-sm">
                        <p className="font-semibold">
                            {result.imported !== undefined
                                ? `${result.imported} baris tersimpan.`
                                : `${result.rowCount || 0} baris dibaca, ${result.errors?.length || 0} bermasalah.`}
                        </p>
                        {result.ringkasan && (
                            <p className="mt-1 text-xs">
                                {result.ringkasan.tambah} baru ditambahkan, {result.ringkasan.perbarui} lama diperbarui.
                            </p>
                        )}
                        {result.errors && result.errors.length > 0 && (
                            <div className="mt-2 max-h-40 overflow-y-auto rounded bg-red-50 p-2 text-xs text-red-700">
                                {result.errors.slice(0, 25).map((err) => (
                                    <p key={`${err.row}-${err.message}`}>Baris {err.row}: {err.message}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
