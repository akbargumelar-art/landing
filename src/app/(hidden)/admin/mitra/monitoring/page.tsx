"use client";

import React from "react";
import { Activity, Camera, ClipboardList, History, Images, PieChart } from "lucide-react";

import { FotoPanel } from "@/components/admin/mitra/foto-panel";
import { GaleriPanel } from "@/components/admin/mitra/galeri-panel";
import { ImportPanel } from "@/components/admin/mitra/import-panel";
import { MarketSharePanel } from "@/components/admin/mitra/market-share-panel";
import { PerformancePanel } from "@/components/admin/mitra/performance-panel";
import { PerubahanPanel } from "@/components/admin/mitra/perubahan-panel";

const TABS = [
    { key: "foto", label: "Monitoring Foto", icon: Camera },
    { key: "galeri", label: "Galeri Foto", icon: Images },
    { key: "perubahan", label: "Perubahan Outlet", icon: History },
    { key: "detail", label: "Detail Outlet", icon: ClipboardList },
    { key: "performance", label: "Performance", icon: Activity },
    { key: "market", label: "Market Share", icon: PieChart },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminMonitoringVisitPage() {
    const [tab, setTab] = React.useState<TabKey>("foto");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Monitoring Visit</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Semua yang berubah pada outlet setelah dikunjungi: foto, titik lokasi, branding, detail
                    penjualan, dan pangsa pasar wilayahnya.
                </p>
            </div>

            <div className="inline-flex flex-wrap rounded-lg border bg-white p-1">
                {TABS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setTab(item.key)}
                        className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                            tab === item.key ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === "foto" && <FotoPanel />}
            {tab === "galeri" && <GaleriPanel />}
            {tab === "perubahan" && <PerubahanPanel />}
            {tab === "detail" && (
                <ImportPanel
                    type="outlet_detail"
                    title="Detail Outlet — Sellthru & Recharge"
                    description="Satu baris per outlet, satu kolom per parameter (Sellthru Digipos, Sellthru Nota, Recharge Digipos). Berkas boleh memuat sebagian kolom saja; kolom yang tidak dikirim tidak akan menghapus angka yang sudah tersimpan."
                />
            )}
            {tab === "performance" && (
                <div className="space-y-6">
                    <ImportPanel
                        type="performance"
                        title="Unggah Performansi Outlet"
                        description="Metric per outlet per periode (YYYY-MM). Gunakan metricKey yang terdaftar pada tabel Metric Definition di bawah."
                    />
                    <PerformancePanel />
                </div>
            )}
            {tab === "market" && <MarketSharePanel />}
        </div>
    );
}
