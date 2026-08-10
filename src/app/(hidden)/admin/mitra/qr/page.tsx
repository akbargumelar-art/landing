"use client";

import React from "react";
import Link from "next/link";
import { Download, LayoutTemplate, Loader2, QrCode } from "lucide-react";

import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminMitraQrPage() {
    const [idsText, setIdsText] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [templates, setTemplates] = React.useState<{ id: string; name: string; isDefault: boolean }[]>([]);
    const [templateId, setTemplateId] = React.useState("");

    React.useEffect(() => {
        fetch("/api/admin/mitra/qr-templates")
            .then((res) => res.json())
            .then((data) => setTemplates(Array.isArray(data.templates) ? data.templates : []))
            .catch(() => setTemplates([]));
    }, []);

    const exportPdf = async () => {
        setLoading(true);
        const outletIds = idsText.split("\n").map((item) => item.trim()).filter(Boolean);
        const res = await fetch("/api/admin/mitra/qr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outletIds, templateId: templateId || null }),
        });
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "mitra-qr-cards.pdf";
            a.click();
            URL.revokeObjectURL(url);
        } else {
            alert("Gagal export QR");
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <BackLink href="/admin/mitra/outlet" label="Kembali ke Database Outlet" />

            <div>
                <h1 className="text-2xl font-bold">QR Mitra Outlet</h1>
                <p className="mt-1 text-sm text-muted-foreground">Generate kartu QR outlet ukuran 90 x 55 mm, 2 x 5 per A4.</p>
            </div>

            <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                        <h2 className="font-bold">Template Kartu</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Atur latar, logo, posisi QR, dan field yang dicetak. Tanpa template tersimpan, tata letak bawaan yang dipakai.
                        </p>
                    </div>
                    <Link href="/admin/mitra/qr/template" className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50">
                        <LayoutTemplate className="h-4 w-4" />
                        Buka Template Builder
                    </Link>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="max-w-2xl space-y-4 p-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <QrCode className="h-7 w-7" />
                    </div>
                    <div className="space-y-2">
                        <Label>Template yang dipakai</Label>
                        <select
                            value={templateId}
                            onChange={(event) => setTemplateId(event.target.value)}
                            className="h-10 w-full rounded-md border px-3 text-sm"
                        >
                            <option value="">
                                {templates.some((item) => item.isDefault) ? "Template cetak aktif" : "Tata letak bawaan"}
                            </option>
                            {templates.map((item) => (
                                <option key={item.id} value={item.id}>{item.name}{item.isDefault ? " (aktif)" : ""}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label>Outlet IDs opsional</Label>
                        <textarea
                            value={idsText}
                            onChange={(event) => setIdsText(event.target.value)}
                            className="min-h-32 w-full rounded-md border px-3 py-2 text-sm"
                            placeholder="Kosongkan untuk export maksimal 100 outlet pertama, atau isi satu outlet id per baris."
                        />
                    </div>
                    <div className="rounded-lg bg-gray-50 p-4 text-sm text-muted-foreground">
                        QR URL mengikuti `BETTER_AUTH_URL` atau `NEXT_PUBLIC_SITE_URL`, sehingga kartu akan mengarah ke domain produksi saat env sudah benar.
                    </div>
                    <Button onClick={exportPdf} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Export PDF Bulk
                    </Button>
                    <Input value="/api/public/mitra/outlets/{publicToken}/qr?format=png" readOnly />
                </CardContent>
            </Card>
        </div>
    );
}
