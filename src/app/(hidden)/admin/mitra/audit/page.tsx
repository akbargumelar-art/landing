"use client";

import React from "react";
import { ClipboardList, Loader2, Search } from "lucide-react";

import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TombolUrut } from "@/components/ui/sortable-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { urutkanBaris, useUrutTabel } from "@/lib/use-sort";

interface AuditLog {
    id: string;
    action: string;
    entity: string;
    entityId?: string;
    userName?: string;
    userEmail?: string;
    ip?: string;
    diffJson?: Record<string, unknown>;
    createdAt: string;
}

export default function AdminMitraAuditPage() {
    const [logs, setLogs] = React.useState<AuditLog[]>([]);
    const [q, setQ] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const { urut, gantiUrut } = useUrutTabel<string>("");

    const load = React.useCallback(() => {
        setLoading(true);
        fetch(`/api/admin/mitra?resource=audit&q=${encodeURIComponent(q)}`)
            .then((res) => res.json())
            .then((data) => setLogs(Array.isArray(data.logs) ? data.logs : []))
            .finally(() => setLoading(false));
    }, [q]);

    React.useEffect(() => { load(); }, [load]);

    const logsTampil = urutkanBaris(logs, urut, (log, kolom) => {
        if (kolom === "waktu") return new Date(log.createdAt);
        if (kolom === "aktor") return log.userName || log.userEmail || "";
        if (kolom === "aksi") return log.action;
        if (kolom === "entity") return log.entity;
        return "";
    });

    return (
        <div className="space-y-6">
            <BackLink href="/admin/mitra" label="Kembali ke Database Mitra Outlet" />

            <div>
                <h1 className="text-2xl font-bold">Audit Mitra</h1>
                <p className="mt-1 text-sm text-muted-foreground">Jejak aksi penting pada modul Portal Mitra Outlet.</p>
            </div>

            <Card>
                <CardContent className="p-5">
                    <div className="mb-4 flex gap-2">
                        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari entity id" />
                        <Button onClick={load} size="icon" aria-label="Cari">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead><TombolUrut kolom="waktu" label="Waktu" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="aktor" label="Aktor" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="aksi" label="Aksi" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="entity" label="Entity" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead>Diff</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                            ) : logsTampil.length ? logsTampil.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-xs">{new Date(log.createdAt).toLocaleString("id-ID")}</TableCell>
                                    <TableCell><p className="text-sm font-semibold">{log.userName || "-"}</p><p className="text-xs text-muted-foreground">{log.userEmail || log.ip || ""}</p></TableCell>
                                    <TableCell className="font-semibold">{log.action}</TableCell>
                                    <TableCell><p>{log.entity}</p><p className="text-xs text-muted-foreground">{log.entityId}</p></TableCell>
                                    <TableCell className="max-w-sm truncate text-xs">{JSON.stringify(log.diffJson || {})}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground"><ClipboardList className="mx-auto mb-2 h-5 w-5" />Belum ada audit log.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
