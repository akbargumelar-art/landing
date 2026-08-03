"use client";

import React from "react";
import { Award, Loader2, Plus, RefreshCw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Program {
    id: string;
    name: string;
    slug: string;
    status: string;
    isPublic: boolean;
    periodStart: string;
    periodEnd: string;
    params?: { id: string; key: string; label: string; weight: string }[];
}

export default function AdminMitraProgramPage() {
    const [programs, setPrograms] = React.useState<Program[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [selectedProgramId, setSelectedProgramId] = React.useState("");
    const [participantCodes, setParticipantCodes] = React.useState("");
    const [winnersText, setWinnersText] = React.useState("");
    const [managementSaving, setManagementSaving] = React.useState(false);
    const [form, setForm] = React.useState({
        name: "",
        descriptionMd: "",
        mechanismMd: "",
        periodStart: "",
        periodEnd: "",
        status: "DRAFT",
        isPublic: false,
        paramsText: "omzet,Omzet,1\nakuisisi,Akuisisi Outlet,1",
    });

    const load = React.useCallback(() => {
        setLoading(true);
        fetch("/api/admin/mitra/programs")
            .then((res) => res.json())
            .then((data) => setPrograms(Array.isArray(data.programs) ? data.programs : []))
            .finally(() => setLoading(false));
    }, []);

    React.useEffect(() => { load(); }, [load]);

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        const params = form.paramsText.split("\n").map((line) => {
            const [key, label, weight] = line.split(",").map((part) => part?.trim());
            return { key, label: label || key, weight: weight || "1" };
        }).filter((param) => param.key);

        const res = await fetch("/api/admin/mitra/programs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, params }),
        });
        if (res.ok) {
            setForm({ name: "", descriptionMd: "", mechanismMd: "", periodStart: "", periodEnd: "", status: "DRAFT", isPublic: false, paramsText: form.paramsText });
            load();
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal menyimpan program");
        }
        setSaving(false);
    };

    const recompute = async (programId: string) => {
        await fetch("/api/admin/mitra/programs", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "recompute", programId }),
        });
        alert("Leaderboard dihitung ulang.");
    };

    const openManagement = async (programId: string) => {
        const res = await fetch(`/api/admin/mitra/programs/${programId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(data.error || "Gagal memuat program");
            return;
        }
        setSelectedProgramId(programId);
        setParticipantCodes((data.participants || []).map((participant: { outletCode: string }) => participant.outletCode).join("\n"));
        setWinnersText((data.winners || []).map((winner: { outletCode: string; rank: number; prizeLabel?: string | null }) => `${winner.outletCode},${winner.rank},${winner.prizeLabel || ""}`).join("\n"));
    };

    const saveParticipants = async () => {
        setManagementSaving(true);
        const outletCodes = participantCodes.split(/[\n,;]/).map((code) => code.trim()).filter(Boolean);
        const res = await fetch(`/api/admin/mitra/programs/${selectedProgramId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "configure_participants", outletCodes }),
        });
        const data = await res.json().catch(() => ({}));
        setManagementSaving(false);
        if (!res.ok) return alert(data.error || "Gagal menyimpan peserta");
        alert(`${data.participantCount || 0} peserta tersimpan.`);
    };

    const publishWinners = async () => {
        const winners = winnersText.split("\n").map((line) => {
            const [outletCode, rank, ...prizeParts] = line.split(",");
            return { outletCode: outletCode?.trim(), rank: Number(rank), prizeLabel: prizeParts.join(",").trim() };
        }).filter((winner) => winner.outletCode);
        setManagementSaving(true);
        const res = await fetch(`/api/admin/mitra/programs/${selectedProgramId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "publish_winners", winners }),
        });
        const data = await res.json().catch(() => ({}));
        setManagementSaving(false);
        if (!res.ok) return alert(data.error || "Gagal memublikasikan pemenang");
        alert(`${data.winnerCount || 0} pemenang dipublikasikan.`);
        load();
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Program Mitra</h1>
                <p className="mt-1 text-sm text-muted-foreground">Builder program, parameter score, publish, dan leaderboard.</p>
            </div>

            <Card>
                <CardContent className="p-5">
                    <form onSubmit={save} className="grid gap-3 lg:grid-cols-4">
                        <div className="space-y-2 lg:col-span-2">
                            <Label>Nama Program</Label>
                            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Mulai</Label>
                            <Input type="date" value={form.periodStart} onChange={(event) => setForm((prev) => ({ ...prev, periodStart: event.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Selesai</Label>
                            <Input type="date" value={form.periodEnd} onChange={(event) => setForm((prev) => ({ ...prev, periodEnd: event.target.value }))} />
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <Label>Deskripsi Publik</Label>
                            <Textarea value={form.descriptionMd} onChange={(event) => setForm((prev) => ({ ...prev, descriptionMd: event.target.value }))} rows={3} />
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <Label>Mekanisme</Label>
                            <Textarea value={form.mechanismMd} onChange={(event) => setForm((prev) => ({ ...prev, mechanismMd: event.target.value }))} rows={3} />
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <Label>Parameter Score (key,label,weight per baris)</Label>
                            <Textarea value={form.paramsText} onChange={(event) => setForm((prev) => ({ ...prev, paramsText: event.target.value }))} rows={4} />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                <option value="DRAFT">DRAFT</option>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="ENDED">ENDED</option>
                                <option value="PUBLISHED">PUBLISHED</option>
                            </select>
                        </div>
                        <label className="flex items-end gap-2 pb-2 text-sm">
                            <input type="checkbox" checked={form.isPublic} onChange={(event) => setForm((prev) => ({ ...prev, isPublic: event.target.checked }))} />
                            Tampilkan publik
                        </label>
                        <Button disabled={saving} className="lg:col-span-4">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Tambah Program
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Program</TableHead>
                                <TableHead>Periode</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Params</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                            ) : programs.length ? programs.map((program) => (
                                <TableRow key={program.id}>
                                    <TableCell><p className="font-semibold">{program.name}</p><p className="text-xs text-muted-foreground">/mitra/program/{program.slug}</p></TableCell>
                                    <TableCell className="text-sm">{new Date(program.periodStart).toLocaleDateString("id-ID")} - {new Date(program.periodEnd).toLocaleDateString("id-ID")}</TableCell>
                                    <TableCell>{program.status} {program.isPublic ? "(Public)" : ""}</TableCell>
                                    <TableCell>{program.params?.length || 0}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => openManagement(program.id)}>Kelola</Button>
                                            <Button variant="outline" size="sm" onClick={() => recompute(program.id)}>
                                                <RefreshCw className="h-4 w-4" />
                                                Recompute
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Belum ada program mitra.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {selectedProgramId && (
                <Card>
                    <CardContent className="grid gap-5 p-5 lg:grid-cols-2">
                        <div className="space-y-3">
                            <div>
                                <h2 className="font-bold">Peserta Program</h2>
                                <p className="text-sm text-muted-foreground">Masukkan kode outlet, satu per baris atau dipisahkan koma.</p>
                            </div>
                            <Textarea value={participantCodes} onChange={(event) => setParticipantCodes(event.target.value)} rows={10} placeholder="OUTLET-001" />
                            <Button variant="outline" onClick={saveParticipants} disabled={managementSaving}>
                                <Save className="h-4 w-4" /> Simpan Peserta
                            </Button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <h2 className="font-bold">Pemenang</h2>
                                <p className="text-sm text-muted-foreground">Format per baris: kode outlet, peringkat, hadiah.</p>
                            </div>
                            <Textarea value={winnersText} onChange={(event) => setWinnersText(event.target.value)} rows={10} placeholder="OUTLET-001,1,Hadiah Utama" />
                            <Button onClick={publishWinners} disabled={managementSaving}>
                                <Award className="h-4 w-4" /> Publikasikan Pemenang
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
