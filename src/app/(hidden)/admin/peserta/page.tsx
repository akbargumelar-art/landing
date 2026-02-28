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
    DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    CheckCircle, XCircle, Clock, Eye, Search, Download, Loader2, Calendar, Trash2, AlertTriangle
} from "lucide-react";
import Image from "next/image";

interface Submission {
    id: string;
    formId: string;
    status: string;
    submittedAt: string | Date;
    period: string;
    participantName: string;
    participantPhone: string;
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
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    const handleDelete = async () => {
        if (!deletingId) return;
        await fetch(`/api/admin/submissions/${deletingId}`, {
            method: "DELETE",
        });
        setSubmissions((prev) => prev.filter((s) => s.id !== deletingId));
        setDeletingId(null);
        if (selectedSubmission?.id === deletingId) {
            setSelectedSubmission(null);
        }
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
                                    <TableCell className="font-semibold text-gray-900 border-r border-gray-100/50">
                                        {sub.participantName || `Peserta #${sub.id.substring(0, 6)}`}
                                    </TableCell>
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
                                            <button onClick={() => setDeletingId(sub.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer" title="Hapus"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
                <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden rounded-2xl flex flex-col max-h-[90vh]">
                    <DialogHeader className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 shrink-0">
                        <DialogTitle className="text-xl font-bold flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                    Detail Peserta
                                </span>
                                <span className="text-gray-500 font-normal text-sm">
                                    #{selectedSubmission?.id.substring(0, 8)}
                                </span>
                            </div>
                            <div className="text-2xl mt-1 text-gray-900">
                                {selectedSubmission?.participantName}
                            </div>
                            <div className="text-sm font-medium text-gray-500 flex items-center gap-2 mt-1">
                                <span>📞 {selectedSubmission?.participantPhone}</span>
                            </div>
                        </DialogTitle>
                        <DialogDescription className="sr-only">Detail informasi peserta undian</DialogDescription>
                    </DialogHeader>
                    {selectedSubmission && (
                        <div className="space-y-4 p-6 overflow-y-auto flex-1">
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

                            <div className="mt-6 space-y-5">
                                <h4 className="text-sm font-semibold text-gray-900 border-b pb-2 mb-4">Detail Jawaban Form</h4>

                                {selectedSubmission.values && selectedSubmission.values.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-y-4">
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {selectedSubmission.values.map((val: any) => (
                                            <div key={val.id} className="flex flex-col group">
                                                {/* Label Pertanyaan */}
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                                                    {val.field?.label || 'Pertanyaan Tanpa Label'}
                                                </label>

                                                {/* Jawaban */}
                                                <div className="text-sm text-gray-900 font-medium">
                                                    {(val.field?.fieldType === 'image' || val.field?.fieldType === 'file' || (typeof val.value === 'string' && val.value.startsWith('/api/public/uploads'))) ? (
                                                        <div className="mt-1">
                                                            {/* Check if it's an image based on the file extension/path */}
                                                            {typeof val.filePath === 'string' && val.filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i) || (typeof val.value === 'string' && val.value.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                                                                <div
                                                                    className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                                                                    onClick={() => setLightboxImage(val.filePath || val.value)}
                                                                >
                                                                    <Image
                                                                        src={val.filePath || val.value}
                                                                        alt="Lampiran"
                                                                        fill
                                                                        className="object-cover"
                                                                        unoptimized
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <a
                                                                    href={val.filePath || val.value}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                                                                >
                                                                    📄 Lihat File
                                                                </a>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="bg-gray-50 px-3 py-2 rounded border border-gray-200 mt-1 whitespace-pre-wrap">
                                                            {val.value || '-'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200 text-sm text-center">
                                        Belum ada detail jawaban yang tersimpan untuk peserta ini.
                                    </div>
                                )}
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

            {/* Delete Confirmation */}
            <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" /> Hapus Data
                        </DialogTitle>
                        <DialogDescription>
                            Apakah Anda yakin ingin menghapus data peserta ini? Data yang dihapus tidak dapat dikembalikan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeletingId(null)} className="cursor-pointer">
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} className="cursor-pointer">
                            Hapus Peserta
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
