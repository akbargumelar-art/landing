"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    CheckCircle, XCircle, Clock, Eye, Search, Download, Loader2, FileImage, Calendar,
} from "lucide-react";
import Image from "next/image";

interface Submission {
    id: string;
    status: string;
    period: string;
    submittedAt: string;
    form: {
        title: string;
        program: { id: string; title: string };
        fields: { id: string; label: string; fieldType: string; sortOrder: number }[];
    };
    values: { fieldId: string; value: string; filePath: string; field: { label: string; fieldType: string } }[];
    winner: { name: string } | null;
}

interface Program {
    id: string;
    title: string;
}

export default function PesertaPage() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterProgram, setFilterProgram] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [search, setSearch] = useState("");
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [editingPeriod, setEditingPeriod] = useState("");
    const [savingPeriod, setSavingPeriod] = useState(false);

    const fetchSubmissions = () => {
        const params = new URLSearchParams();
        if (filterProgram) params.set("programId", filterProgram);
        if (filterStatus) params.set("status", filterStatus);
        if (search) params.set("search", search);

        fetch(`/api/admin/submissions?${params}`)
            .then((r) => r.json())
            .then((data) => { setSubmissions(data); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetch("/api/admin/programs").then((r) => r.json()).then(setPrograms).catch(() => { });
    }, []);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(fetchSubmissions, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterProgram, filterStatus, search]);

    const updateStatus = async (id: string, status: string) => {
        await fetch(`/api/admin/submissions/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        setSubmissions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, status } : s))
        );
        if (selectedSubmission?.id === id) {
            setSelectedSubmission({ ...selectedSubmission, status });
        }
    };

    const updatePeriod = async (id: string, period: string) => {
        setSavingPeriod(true);
        await fetch(`/api/admin/submissions/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ period }),
        });
        setSubmissions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, period } : s))
        );
        if (selectedSubmission?.id === id) {
            setSelectedSubmission({ ...selectedSubmission, period });
        }
        setSavingPeriod(false);
    };

    const handleExport = async () => {
        setExporting(true);
        const params = new URLSearchParams();
        if (filterProgram) params.set("programId", filterProgram);

        const res = await fetch(`/api/admin/submissions/export?${params}`);
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `data-peserta-${Date.now()}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        }
        setExporting(false);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
            case "rejected": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
            default: return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
        }
    };

    const getPreviewValue = (sub: Submission): string => {
        let nameField = sub.values.find((v) => v.field?.fieldType === "name");
        if (!nameField) nameField = sub.values.find((v) => v.field?.label && /nama|name|lengkap|peserta/i.test(v.field.label) && !/phone|email|hp|telp/i.test(v.field.fieldType || "") && !/phone|email|hp|telp|wa/i.test(v.field.label || ""));
        if (!nameField) nameField = sub.values.find((v) => v.field?.fieldType === "text" && !/phone|email|hp|telp|wa/i.test(v.field.label || ""));

        let phoneField = sub.values.find((v) => v.field?.fieldType === "phone");
        if (!phoneField) phoneField = sub.values.find((v) => v.field?.label && /telepon|telp|hp|handphone|nomor|wa|whatsapp/i.test(v.field.label));
        if (!phoneField) phoneField = sub.values.find((v) => v.field?.fieldType === "number");

        const name = nameField?.value?.trim();
        const phone = phoneField?.value?.trim();

        if (name && phone) return `${name} - ${phone}`;
        if (name) return name;
        if (phone) return `Peserta #${sub.id.slice(0, 6)} - ${phone}`;

        // Fallback to first text field
        const firstText = sub.values.find((v) => v.field?.fieldType === "text" && v.value);
        return firstText?.value?.trim() || `Peserta #${sub.id.slice(0, 8)}`;
    };

    // Collect unique periods from existing submissions for autocomplete
    const existingPeriods = [...new Set(submissions.map(s => s.period).filter(Boolean))].sort();

    if (loading && submissions.length === 0) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="max-w-6xl space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Data Peserta</h2>
                <Button onClick={handleExport} disabled={exporting} variant="outline" className="cursor-pointer">
                    {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export Excel
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari peserta..." className="pl-9" />
                        </div>
                        <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} className="px-3 py-2 border rounded-md text-sm bg-white min-w-[200px]">
                            <option value="">Semua Program</option>
                            {programs.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
                        </select>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-md text-sm bg-white min-w-[140px]">
                            <option value="">Semua Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">No</TableHead>
                                <TableHead>Nama / ID</TableHead>
                                <TableHead>Program</TableHead>
                                <TableHead>Periode</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {submissions.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada data peserta</TableCell></TableRow>
                            ) : submissions.map((sub, i) => (
                                <TableRow key={sub.id}>
                                    <TableCell className="text-sm">{i + 1}</TableCell>
                                    <TableCell className="font-medium text-sm">{getPreviewValue(sub)}</TableCell>
                                    <TableCell className="text-sm">{sub.form.program.title}</TableCell>
                                    <TableCell className="text-sm">
                                        {sub.period ? (
                                            <Badge variant="outline" className="text-xs font-normal">
                                                <Calendar className="h-3 w-3 mr-1" />
                                                {sub.period}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">Belum diatur</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{new Date(sub.submittedAt).toLocaleDateString("id-ID")}</TableCell>
                                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => { setSelectedSubmission(sub); setEditingPeriod(sub.period || ""); }} className="p-2 rounded-lg hover:bg-muted cursor-pointer"><Eye className="h-4 w-4" /></button>
                                            <button onClick={() => updateStatus(sub.id, "approved")} className="p-2 rounded-lg hover:bg-green-50 text-green-600 cursor-pointer" title="Approve"><CheckCircle className="h-4 w-4" /></button>
                                            <button onClick={() => updateStatus(sub.id, "rejected")} className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer" title="Reject"><XCircle className="h-4 w-4" /></button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detail Peserta</DialogTitle>
                    </DialogHeader>
                    {selectedSubmission && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">{selectedSubmission.form.program.title}</p>
                                {getStatusBadge(selectedSubmission.status)}
                            </div>

                            {/* Period Editor */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Periode Program
                                </label>
                                <div className="flex gap-2 mt-2">
                                    <Input
                                        value={editingPeriod}
                                        onChange={(e) => setEditingPeriod(e.target.value)}
                                        placeholder="Contoh: Periode Januari 2026"
                                        className="flex-1 bg-white text-sm"
                                        list="period-suggestions"
                                    />
                                    <Button
                                        size="sm"
                                        disabled={savingPeriod}
                                        onClick={() => updatePeriod(selectedSubmission.id, editingPeriod)}
                                        className="cursor-pointer"
                                    >
                                        {savingPeriod ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
                                    </Button>
                                </div>
                                {/* Autocomplete suggestions from existing periods */}
                                <datalist id="period-suggestions">
                                    {existingPeriods.map((p) => (
                                        <option key={p} value={p} />
                                    ))}
                                </datalist>
                                {selectedSubmission.period && (
                                    <p className="text-xs text-blue-600 mt-1">Saat ini: {selectedSubmission.period}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nomor Registrasi</p>
                                    <p className="text-sm font-medium">{selectedSubmission.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tanggal Daftar</p>
                                    <p className="text-sm font-medium">{new Date(selectedSubmission.submittedAt).toLocaleString("id-ID")}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {selectedSubmission.values.map((val) => (
                                    <div key={val.fieldId} className="border-b pb-3 last:border-0">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{val.field?.label || "Unknown Field"}</p>
                                        {val.field?.fieldType === "file" && val.filePath ? (
                                            <button onClick={() => setLightboxImage(val.filePath)} className="group cursor-pointer">
                                                <div className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                                    <FileImage className="h-4 w-4" />
                                                    <span>{val.value || "Lihat file"}</span>
                                                </div>
                                            </button>
                                        ) : (
                                            <p className="text-sm">{val.value || "—"}</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button size="sm" variant="outline" className="flex-1 cursor-pointer" onClick={() => { updateStatus(selectedSubmission.id, "approved"); }}>
                                    <CheckCircle className="mr-1 h-4 w-4" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1 text-red-600 hover:bg-red-50 cursor-pointer" onClick={() => { updateStatus(selectedSubmission.id, "rejected"); }}>
                                    <XCircle className="mr-1 h-4 w-4" /> Reject
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Image Lightbox */}
            <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
                <DialogContent className="sm:max-w-2xl p-2">
                    <DialogTitle className="sr-only">Preview Gambar</DialogTitle>
                    {lightboxImage && (
                        <div className="relative w-full h-[80vh]">
                            <Image src={lightboxImage} alt="Bukti" fill className="object-contain rounded-lg" unoptimized={true} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
