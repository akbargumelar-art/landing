"use client";

import React from "react";
import { Activity, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MetricDef {
    id: string;
    key: string;
    label: string;
    unit?: string;
    isPublic: boolean;
}

interface MetricRow {
    id: string;
    outletName: string;
    outletCode: string;
    metricDefId: string;
    periodYm: string;
    value: string;
}

interface Outlet {
    id: string;
    name: string;
    outletCode: string;
}

export default function AdminMitraPerformancePage() {
    const [defs, setDefs] = React.useState<MetricDef[]>([]);
    const [metrics, setMetrics] = React.useState<MetricRow[]>([]);
    const [outlets, setOutlets] = React.useState<Outlet[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [defForm, setDefForm] = React.useState({ key: "", label: "", unit: "", isPublic: false });
    const [metricForm, setMetricForm] = React.useState({ outletId: "", metricDefId: "", periodYm: new Date().toISOString().slice(0, 7), value: "" });

    const load = React.useCallback(() => {
        setLoading(true);
        Promise.all([
            fetch("/api/admin/mitra/performance").then((res) => res.json()),
            fetch("/api/admin/mitra/outlets?pageSize=200").then((res) => res.json()),
        ]).then(([perf, outletData]) => {
            setDefs(Array.isArray(perf.metricDefs) ? perf.metricDefs : []);
            setMetrics(Array.isArray(perf.metrics) ? perf.metrics : []);
            setOutlets(Array.isArray(outletData.outlets) ? outletData.outlets : []);
        }).finally(() => setLoading(false));
    }, []);

    React.useEffect(() => { load(); }, [load]);

    const saveDef = async (event: React.FormEvent) => {
        event.preventDefault();
        const res = await fetch("/api/admin/mitra/performance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "metric_def", ...defForm }),
        });
        if (res.ok) {
            setDefForm({ key: "", label: "", unit: "", isPublic: false });
            load();
        }
    };

    const saveMetric = async (event: React.FormEvent) => {
        event.preventDefault();
        const res = await fetch("/api/admin/mitra/performance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(metricForm),
        });
        if (res.ok) {
            setMetricForm((prev) => ({ ...prev, value: "" }));
            load();
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Performance Mitra</h1>
                <p className="mt-1 text-sm text-muted-foreground">Definisikan metric dan input performansi outlet per periode.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardContent className="p-5">
                        <h2 className="mb-4 flex items-center gap-2 font-bold"><Activity className="h-4 w-4 text-red-600" /> Metric Definition</h2>
                        <form onSubmit={saveDef} className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Key</Label>
                                <Input value={defForm.key} onChange={(event) => setDefForm((prev) => ({ ...prev, key: event.target.value }))} placeholder="omzet" />
                            </div>
                            <div className="space-y-2">
                                <Label>Label</Label>
                                <Input value={defForm.label} onChange={(event) => setDefForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Omzet" />
                            </div>
                            <div className="space-y-2">
                                <Label>Unit</Label>
                                <Input value={defForm.unit} onChange={(event) => setDefForm((prev) => ({ ...prev, unit: event.target.value }))} placeholder="Rp / qty / %" />
                            </div>
                            <label className="flex items-end gap-2 pb-2 text-sm">
                                <input type="checkbox" checked={defForm.isPublic} onChange={(event) => setDefForm((prev) => ({ ...prev, isPublic: event.target.checked }))} />
                                Aman untuk publik
                            </label>
                            <Button className="sm:col-span-2"><Plus className="h-4 w-4" /> Tambah Metric</Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5">
                        <h2 className="mb-4 font-bold">Input Manual</h2>
                        <form onSubmit={saveMetric} className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Outlet</Label>
                                <select value={metricForm.outletId} onChange={(event) => setMetricForm((prev) => ({ ...prev, outletId: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="">Pilih outlet</option>
                                    {outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Metric</Label>
                                <select value={metricForm.metricDefId} onChange={(event) => setMetricForm((prev) => ({ ...prev, metricDefId: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="">Pilih metric</option>
                                    {defs.map((def) => <option key={def.id} value={def.id}>{def.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Periode</Label>
                                <Input type="month" value={metricForm.periodYm} onChange={(event) => setMetricForm((prev) => ({ ...prev, periodYm: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Nilai</Label>
                                <Input type="number" value={metricForm.value} onChange={(event) => setMetricForm((prev) => ({ ...prev, value: event.target.value }))} />
                            </div>
                            <Button className="sm:col-span-2">Simpan Nilai</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-5">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Outlet</TableHead>
                                <TableHead>Metric</TableHead>
                                <TableHead>Periode</TableHead>
                                <TableHead className="text-right">Nilai</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                            ) : metrics.length ? metrics.map((metric) => {
                                const def = defs.find((item) => item.id === metric.metricDefId);
                                return (
                                    <TableRow key={metric.id}>
                                        <TableCell><p className="font-semibold">{metric.outletName}</p><p className="text-xs text-muted-foreground">{metric.outletCode}</p></TableCell>
                                        <TableCell>{def?.label || metric.metricDefId}</TableCell>
                                        <TableCell>{metric.periodYm}</TableCell>
                                        <TableCell className="text-right font-bold">{Number(metric.value).toLocaleString("id-ID")} {def?.unit || ""}</TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Belum ada data performansi.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
