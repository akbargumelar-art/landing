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
    CheckCircle, XCircle, Clock, Eye, Search, Download, Loader2, FileImage,
} from "lucide-react";

interface Submission {
    id: string;
    status: string;
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
        const firstText = sub.values.find((v) => v.field.fieldType === "text" && v.value);
        return firstText?.value || sub.id.slice(0, 8);
    };

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
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {submissions.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada data peserta</TableCell></TableRow>
                            ) : submissions.map((sub, i) => (
                                <TableRow key={sub.id}>
                                    <TableCell className="text-sm">{i + 1}</TableCell>
                                    <TableCell className="font-medium text-sm">{getPreviewValue(sub)}</TableCell>
                                    <TableCell className="text-sm">{sub.form.program.title}</TableCell>
                                    <TableCell className="text-sm">{new Date(sub.submittedAt).toLocaleDateString("id-ID")}</TableCell>
                                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => setSelectedSubmission(sub)} className="p-2 rounded-lg hover:bg-muted cursor-pointer"><Eye className="h-4 w-4" /></button>
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

                            <div className="space-y-3">
                                {selectedSubmission.values.map((val) => (
                                    <div key={val.fieldId} className="border-b pb-3 last:border-0">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{val.field.label}</p>
                                        {val.field.fieldType === "file" && val.filePath ? (
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
                        <img src={lightboxImage} alt="Bukti" className="w-full h-auto rounded-lg" />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
