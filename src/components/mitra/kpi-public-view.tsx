"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface KpiParamRow {
    id: string;
    key: string;
    label: string;
    unit: string | null;
    category: "COMPLIANCE" | "PERFORMANCE";
    target: number | null;
    actual: number;
    achievement: number | null;
    gap: number | null;
    weight: number;
    cap: number | null;
    capped: boolean;
    score: number | null;
}

interface KpiParticipant {
    participantKey: string;
    id: string;
    name: string;
    tap: string;
    complianceScore: number;
    performanceScore: number;
    compliancePassed: boolean;
    benefitType: "NONE" | "REWARD" | "PUNISHMENT";
    benefitLabel: string;
    params: KpiParamRow[];
    missingTargetCount: number;
}

export interface KpiPublicPayload {
    summary: {
        salesforceCount: number;
        averageCompliance: number;
        averagePerformance: number;
        rewardCount: number;
        punishmentCount: number;
        missingTargetCount: number;
    };
    complianceMinScore: number | null;
    hidePunishment: boolean;
    taps: {
        tap: string;
        salesforceCount: number;
        complianceScore: number;
        performanceScore: number;
        rewardCount: number;
        punishmentCount: number;
        participants: Omit<KpiParticipant, "params">[];
    }[];
    participants: KpiParticipant[];
    filters: {
        taps: string[];
        salesforces: { id: string; name: string; tap: string }[];
        params: { id: string; key: string; label: string }[];
    };
    outletRows: {
        outletId: string;
        outletCode: string;
        outletName: string;
        tap: string;
        salesforceId: string;
        salesforceName: string;
        paramId: string;
        paramLabel: string;
        unit: string | null;
        actual: number;
    }[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const number = (value: number | null, unit?: string | null) => value === null
    ? "—"
    : `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;

function Benefit({ type, label }: { type: KpiParticipant["benefitType"]; label: string }) {
    const style = type === "REWARD" ? "bg-green-100 text-green-700" : type === "PUNISHMENT" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600";
    return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${style}`}>{label || (type === "NONE" ? "Tanpa benefit" : type)}</span>;
}

function ParamTable({ title, rows }: { title: string; rows: KpiParamRow[] }) {
    const showWeight = title === "Performance" || rows.some((row) => row.weight > 0);
    const scoredRows = rows.filter((row) => row.achievement !== null);
    const weightedRows = scoredRows.filter((row) => row.weight > 0);
    const total = title === "Performance"
        ? rows.reduce((sum, row) => sum + (row.score || 0), 0)
        : scoredRows.length
            ? (weightedRows.length > 0
                ? weightedRows.reduce((sum, row) => sum + row.achievement! * row.weight, 0) / weightedRows.reduce((sum, row) => sum + row.weight, 0)
                : scoredRows.reduce((sum, row) => sum + row.achievement!, 0) / scoredRows.length)
            : 0;
    return (
        <div className="space-y-2">
            <h4 className="font-bold text-gray-950">{title}</h4>
            <div className="max-w-full overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-muted-foreground"><tr>
                        <th className="px-3 py-2 text-left">Parameter</th><th className="px-3 py-2 text-right">Target</th>
                        <th className="px-3 py-2 text-right">Aktual</th><th className="px-3 py-2 text-right">Achievement</th>
                        <th className="px-3 py-2 text-right">GAP</th>{showWeight && <th className="px-3 py-2 text-right">Bobot</th>}
                        <th className="px-3 py-2 text-right">Skor</th>
                    </tr></thead>
                    <tbody>
                        {rows.map((row) => <tr key={row.id} className="border-t">
                            <td className="px-3 py-2 font-medium">{row.label}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{number(row.target, row.unit)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{number(row.actual, row.unit)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{row.achievement === null ? "—" : `${number(row.achievement)}%${row.capped ? "*" : ""}`}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{number(row.gap, row.unit)}</td>
                            {showWeight && <td className="px-3 py-2 text-right tabular-nums">{row.weight}%</td>}
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">{number(row.score)}</td>
                        </tr>)}
                        <tr className="border-t bg-gray-50 font-bold"><td className="px-3 py-2" colSpan={showWeight ? 6 : 5}>Total</td><td className="px-3 py-2 text-right">{number(total)}%</td></tr>
                    </tbody>
                </table>
            </div>
            {rows.some((row) => row.capped) && <p className="text-xs text-muted-foreground">* Achievement dibatasi sesuai cap parameter.</p>}
        </div>
    );
}

export function KpiPublicView({ slug, initial }: { slug: string; initial: KpiPublicPayload }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [data, setData] = React.useState(initial);
    const [loading, setLoading] = React.useState(false);
    const [filters, setFilters] = React.useState({
        tap: searchParams.get("tap") || "",
        sf: searchParams.get("sf") || "",
        param: searchParams.get("param") || "",
        q: searchParams.get("q") || "",
    });

    const load = async (next: typeof filters, page = 1) => {
        const params = new URLSearchParams();
        params.set("targetType", "SALESFORCE");
        Object.entries(next).forEach(([key, value]) => { if (value) params.set(key, value); });
        if (page > 1) params.set("page", String(page));
        const visible = new URLSearchParams(params); visible.delete("targetType");
        router.replace(`?${visible.toString()}`, { scroll: false });
        setLoading(true);
        try {
            const response = await fetch(`/api/public/mitra/programs/${slug}?${params.toString()}`);
            const payload = await response.json();
            if (response.ok && payload.kpi) setData(payload.kpi);
        } finally { setLoading(false); }
    };

    const sfOptions = data.filters.salesforces.filter((sf) => !filters.tap || sf.tap === filters.tap);
    return (
        <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    ["Salesforce dinilai", data.summary.salesforceCount],
                    ["Rata-rata Compliance", `${number(data.summary.averageCompliance)}%`],
                    ["Rata-rata Performance", `${number(data.summary.averagePerformance)}%`],
                    ["Benefit", `${data.summary.rewardCount} reward · ${data.summary.punishmentCount} punishment`],
                ].map(([label, value]) => <div key={label} className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xl font-extrabold text-gray-950">{value}</p></div>)}
            </div>

            {data.summary.missingTargetCount > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{data.summary.missingTargetCount} target belum diisi; parameter tersebut ditandai “—” dan tidak masuk perhitungan.</p>}

            <div className="rounded-lg border bg-white p-4 shadow-sm">
                <h2 className="mb-3 font-bold">Ringkasan per TAP</h2>
                <div className="space-y-2">{data.taps.map((tap) => <details key={tap.tap} className="rounded-lg border">
                    <summary className="cursor-pointer list-none p-3"><div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-6"><strong>{tap.tap}</strong><span>{tap.salesforceCount} SF</span><span>C {number(tap.complianceScore)}%</span><span>P {number(tap.performanceScore)}%</span><span>{tap.rewardCount} reward</span><span>{tap.punishmentCount} punishment</span></div></summary>
                    <div className="max-w-full overflow-x-auto border-t"><table className="w-full min-w-[620px] text-sm"><tbody>{tap.participants.map((sf) => <tr key={sf.id} className="border-b last:border-0"><td className="px-3 py-2 font-medium">{sf.name}</td><td className="px-3 py-2">C {number(sf.complianceScore)}%</td><td className="px-3 py-2">P {number(sf.performanceScore)}%</td><td className="px-3 py-2"><Benefit type={sf.benefitType} label={sf.benefitLabel} /></td></tr>)}</tbody></table></div>
                </details>)}</div>
            </div>

            <div className="rounded-lg border bg-white p-4 shadow-sm">
                <h2 className="mb-3 font-bold">Ringkasan per Salesforce</h2>
                <div className="space-y-2">{data.participants.map((sf) => <details key={sf.id} className="rounded-lg border">
                    <summary className="cursor-pointer list-none p-3"><div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5"><strong>{sf.name}</strong><span>{sf.tap}</span><span>C {number(sf.complianceScore)}%</span><span>P {number(sf.performanceScore)}%</span><span><Benefit type={sf.benefitType} label={sf.benefitLabel} /></span></div></summary>
                    <div className="space-y-5 border-t p-3">
                        {!sf.compliancePassed && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Skor performance tidak menghasilkan reward karena compliance di bawah {number(data.complianceMinScore)}%.</p>}
                        <ParamTable title="Compliance" rows={sf.params.filter((row) => row.category === "COMPLIANCE")} />
                        <ParamTable title="Performance" rows={sf.params.filter((row) => row.category === "PERFORMANCE")} />
                    </div>
                </details>)}</div>
            </div>

            <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2"><Filter className="h-4 w-4 text-red-600" /><h2 className="font-bold">Pencapaian per Outlet</h2></div>
                <form className="mb-4 grid gap-2 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); load(filters); }}>
                    <select className="h-10 rounded-md border px-3 text-sm" value={filters.tap} onChange={(e) => setFilters((old) => ({ ...old, tap: e.target.value, sf: "" }))}><option value="">Semua TAP</option>{data.filters.taps.map((tap) => <option key={tap}>{tap}</option>)}</select>
                    <select className="h-10 rounded-md border px-3 text-sm" value={filters.sf} onChange={(e) => setFilters((old) => ({ ...old, sf: e.target.value }))}><option value="">Semua Salesforce</option>{sfOptions.map((sf) => <option key={sf.id} value={sf.id}>{sf.name}</option>)}</select>
                    <select className="h-10 rounded-md border px-3 text-sm" value={filters.param} onChange={(e) => setFilters((old) => ({ ...old, param: e.target.value }))}><option value="">Semua Parameter</option>{data.filters.params.map((param) => <option key={param.id} value={param.id}>{param.label}</option>)}</select>
                    <div className="flex gap-2"><Input value={filters.q} onChange={(e) => setFilters((old) => ({ ...old, q: e.target.value }))} placeholder="Nama/kode outlet" /><Button type="submit" disabled={loading}><Search className="h-4 w-4" /></Button></div>
                </form>
                <div className="max-w-full overflow-x-auto rounded-lg border"><table className="w-full min-w-[820px] text-sm"><thead className="bg-gray-50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2 text-left">Outlet</th><th className="px-3 py-2 text-left">Kode</th><th className="px-3 py-2 text-left">TAP</th><th className="px-3 py-2 text-left">Salesforce</th><th className="px-3 py-2 text-left">Parameter</th><th className="px-3 py-2 text-right">Aktual</th></tr></thead><tbody>{data.outletRows.map((row) => <tr key={`${row.outletId}-${row.paramId}`} className="border-t"><td className="px-3 py-2 font-medium">{row.outletName}</td><td className="px-3 py-2 font-mono text-xs">{row.outletCode}</td><td className="px-3 py-2">{row.tap}</td><td className="px-3 py-2">{row.salesforceName}</td><td className="px-3 py-2">{row.paramLabel}</td><td className="px-3 py-2 text-right tabular-nums">{number(row.actual, row.unit)}</td></tr>)}{data.outletRows.length === 0 && <tr><td colSpan={6} className="h-24 text-center text-muted-foreground">Tidak ada data yang cocok.</td></tr>}</tbody></table></div>
                <div className="mt-3 flex items-center justify-between text-sm"><span>{data.pagination.total} baris · halaman {data.pagination.page}/{data.pagination.totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || data.pagination.page <= 1} onClick={() => load(filters, data.pagination.page - 1)}><ChevronLeft className="h-4 w-4" /> Sebelumnya</Button><Button variant="outline" size="sm" disabled={loading || data.pagination.page >= data.pagination.totalPages} onClick={() => load(filters, data.pagination.page + 1)}>Berikutnya <ChevronRight className="h-4 w-4" /></Button></div></div>
            </div>
        </section>
    );
}
