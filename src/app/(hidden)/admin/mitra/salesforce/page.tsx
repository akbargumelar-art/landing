"use client";

import React from "react";
import { BadgeCheck, Building2, Map, MapPin } from "lucide-react";

import { MasterListPanel } from "@/components/admin/mitra/master-list-panel";
import { SalesforcePanel } from "@/components/admin/mitra/salesforce-panel";

const TABS = [
    { key: "salesforce", label: "Salesforce", icon: BadgeCheck },
    { key: "tap", label: "TAP", icon: Map },
    { key: "kabupaten", label: "Kabupaten", icon: Building2 },
    { key: "kecamatan", label: "Kecamatan", icon: MapPin },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminDatabaseSalesforcePage() {
    const [tab, setTab] = React.useState<TabKey>("salesforce");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Database Salesforce</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Master salesforce beserta daftar wilayah yang mengisi pilihan TAP, Kabupaten, dan Kecamatan
                    di seluruh form outlet.
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

            {tab === "salesforce" ? <SalesforcePanel /> : <MasterListPanel type={tab} label={TABS.find((item) => item.key === tab)!.label} />}
        </div>
    );
}
