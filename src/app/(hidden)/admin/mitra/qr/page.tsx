"use client";

import React from "react";
import { Download, Loader2, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminMitraQrPage() {
    const [idsText, setIdsText] = React.useState("");
    const [loading, setLoading] = React.useState(false);

    const exportPdf = async () => {
        setLoading(true);
        const outletIds = idsText.split("\n").map((item) => item.trim()).filter(Boolean);
        const res = await fetch("/api/admin/mitra/qr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outletIds }),
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
            <div>
                <h1 className="text-2xl font-bold">QR Mitra Outlet</h1>
                <p className="mt-1 text-sm text-muted-foreground">Generate kartu QR outlet ukuran 90 x 55 mm, 2 x 5 per A4.</p>
            </div>

            <Card>
                <CardContent className="max-w-2xl space-y-4 p-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <QrCode className="h-7 w-7" />
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
