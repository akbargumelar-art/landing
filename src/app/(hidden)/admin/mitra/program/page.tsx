"use client";

import React from "react";
import { Award, Loader2, Plus, RefreshCw, Save, Search, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TombolUrut } from "@/components/ui/sortable-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { urutkanBaris, useUrutTabel } from "@/lib/use-sort";

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

interface Peserta {
    outletId: string;
    outletCode: string;
    outletName: string;
}

interface RewardRule {
    id?: string;
    ruleType: "RANK" | "THRESHOLD";
    rankFrom?: number | null;
    rankTo?: number | null;
    paramKey?: string | null;
    comparator?: string | null;
    thresholdValue?: string | null;
    rewardLabel: string;
}

interface RewardPreviewRow {
    outletId: string;
    outletCode: string;
    outletName: string;
    ruleId: string;
    rewardLabel: string;
}

/** "RANK,1,1,Motor" / "THRESHOLD,omzet,>=,5000000,Voucher 500rb" -> baris aturan reward. */
function parseRewardRulesText(text: string): RewardRule[] {
    return text.split("\n").map((line) => {
        const parts = line.split(",").map((part) => part.trim());
        if (parts[0]?.toUpperCase() === "THRESHOLD") {
            const [, paramKey, comparator, thresholdValue, ...labelParts] = parts;
            return {
                ruleType: "THRESHOLD" as const,
                paramKey: paramKey || null,
                comparator: comparator || ">=",
                thresholdValue: thresholdValue || "0",
                rewardLabel: labelParts.join(",").trim(),
            };
        }
        const [, rankFrom, rankTo, ...labelParts] = parts;
        return {
            ruleType: "RANK" as const,
            rankFrom: Number(rankFrom) || null,
            rankTo: Number(rankTo) || Number(rankFrom) || null,
            rewardLabel: labelParts.join(",").trim(),
        };
    }).filter((rule) => rule.rewardLabel);
}

export default function AdminMitraProgramPage() {
    const [programs, setPrograms] = React.useState<Program[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [selectedProgramId, setSelectedProgramId] = React.useState("");
    const [participants, setParticipants] = React.useState<Peserta[]>([]);
    const [outletQuery, setOutletQuery] = React.useState("");
    const [outletResults, setOutletResults] = React.useState<Peserta[]>([]);
    const [outletSearching, setOutletSearching] = React.useState(false);
    const [winnersText, setWinnersText] = React.useState("");
    const [managementSaving, setManagementSaving] = React.useState(false);
    const [rewardsPreview, setRewardsPreview] = React.useState<RewardPreviewRow[]>([]);
    const [rewardsLoading, setRewardsLoading] = React.useState(false);
    const { urut, gantiUrut } = useUrutTabel<string>("");
    const [form, setForm] = React.useState({
        name: "",
        descriptionMd: "",
        mechanismMd: "",
        periodStart: "",
        periodEnd: "",
        status: "DRAFT",
        isPublic: false,
        mechanismType: "RANKING",
        paramsText: "omzet,Omzet,1\nakuisisi,Akuisisi Outlet,1",
        rewardRulesText: "RANK,1,1,Hadiah Juara 1\nRANK,2,3,Hadiah Juara 2-3",
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
        const rewardRules = parseRewardRulesText(form.rewardRulesText);

        const res = await fetch("/api/admin/mitra/programs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, params, rewardRules }),
        });
        if (res.ok) {
            setForm({
                name: "", descriptionMd: "", mechanismMd: "", periodStart: "", periodEnd: "",
                status: "DRAFT", isPublic: false, mechanismType: "RANKING",
                paramsText: form.paramsText, rewardRulesText: form.rewardRulesText,
            });
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
        setParticipants(data.participants || []);
        setWinnersText((data.winners || []).map((winner: { outletCode: string; rank: number; prizeLabel?: string | null }) => `${winner.outletCode},${winner.rank},${winner.prizeLabel || ""}`).join("\n"));
        setOutletQuery("");
        setOutletResults([]);
        setRewardsPreview([]);
    };

    // Peserta selalu berasal dari pencarian ke database outlet admin/mitra, bukan kode
    // yang diketik bebas -- supaya program tidak pernah menunjuk outlet yang tidak ada.
    React.useEffect(() => {
        if (!outletQuery.trim()) { setOutletResults([]); return; }
        setOutletSearching(true);
        const timer = setTimeout(() => {
            fetch(`/api/admin/mitra/outlets?q=${encodeURIComponent(outletQuery)}&pageSize=8`)
                .then((res) => res.json())
                .then((data) => setOutletResults(
                    (data.outlets || []).map((outlet: { id: string; outletCode: string; name: string }) => ({
                        outletId: outlet.id, outletCode: outlet.outletCode, outletName: outlet.name,
                    }))
                ))
                .finally(() => setOutletSearching(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [outletQuery]);

    const tambahPeserta = (outlet: Peserta) => {
        setParticipants((prev) => prev.some((item) => item.outletId === outlet.outletId) ? prev : [...prev, outlet]);
        setOutletQuery("");
        setOutletResults([]);
    };

    const hapusPeserta = (outletId: string) => {
        setParticipants((prev) => prev.filter((item) => item.outletId !== outletId));
    };

    const saveParticipants = async () => {
        setManagementSaving(true);
        const outletCodes = participants.map((peserta) => peserta.outletCode);
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

    const hitungReward = async () => {
        setRewardsLoading(true);
        const res = await fetch("/api/admin/mitra/programs", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "compute_rewards", programId: selectedProgramId }),
        });
        const data = await res.json().catch(() => ({}));
        setRewardsLoading(false);
        if (!res.ok) return alert(data.error || "Gagal menghitung reward");
        setRewardsPreview(data.rewards || []);
        if ((data.rewards || []).length === 0) alert("Belum ada outlet yang cocok dengan aturan reward, atau leaderboard belum di-recompute.");
    };

    const isiKePemenang = () => {
        setWinnersText(rewardsPreview.map((row, index) => `${row.outletCode},${index + 1},${row.rewardLabel}`).join("\n"));
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

    const programsTampil = urutkanBaris(programs, urut, (program, kolom) => {
        if (kolom === "program") return program.name;
        if (kolom === "periode") return new Date(program.periodStart);
        if (kolom === "status") return program.status;
        if (kolom === "params") return program.params?.length || 0;
        return "";
    });

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
                            <p className="text-xs text-muted-foreground">Weight otomatis dikalikan ke setiap pencapaian yang diupload — tidak perlu dihitung manual.</p>
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
                        <div className="space-y-2">
                            <Label>Mekanisme Reward</Label>
                            <select value={form.mechanismType} onChange={(event) => setForm((prev) => ({ ...prev, mechanismType: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                <option value="RANKING">Racing (berdasarkan peringkat)</option>
                                <option value="THRESHOLD">Threshold (berdasarkan target)</option>
                                <option value="HYBRID">Keduanya</option>
                            </select>
                        </div>
                        <div className="space-y-2 lg:col-span-3">
                            <Label>Aturan Reward (per baris)</Label>
                            <Textarea value={form.rewardRulesText} onChange={(event) => setForm((prev) => ({ ...prev, rewardRulesText: event.target.value }))} rows={3} />
                            <p className="text-xs text-muted-foreground">
                                Racing: <code>RANK,dariPeringkat,sampaiPeringkat,label</code> — mis. <code>RANK,1,1,Motor</code>.{" "}
                                Threshold: <code>THRESHOLD,paramKey,pembanding,nilai,label</code> — mis. <code>THRESHOLD,omzet,&gt;=,5000000,Voucher 500rb</code> (paramKey kosong = total poin leaderboard).
                            </p>
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
                                <TableHead><TombolUrut kolom="program" label="Program" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="periode" label="Periode" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="status" label="Status" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="params" label="Params" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                            ) : programsTampil.length ? programsTampil.map((program) => (
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
                                <p className="text-sm text-muted-foreground">Cari dari database outlet mitra, lalu klik untuk menambahkan.</p>
                            </div>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={outletQuery}
                                    onChange={(event) => setOutletQuery(event.target.value)}
                                    placeholder="Cari nama atau kode outlet..."
                                    className="pl-9"
                                />
                                {outletSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                                {outletResults.length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
                                        {outletResults.map((outlet) => (
                                            <button
                                                type="button"
                                                key={outlet.outletId}
                                                onClick={() => tambahPeserta(outlet)}
                                                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                                            >
                                                <span className="font-medium">{outlet.outletName}</span>
                                                <span className="text-xs text-muted-foreground">{outlet.outletCode}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                                {participants.length === 0 && <p className="p-2 text-sm text-muted-foreground">Belum ada peserta.</p>}
                                {participants.map((peserta) => (
                                    <div key={peserta.outletId} className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted">
                                        <div>
                                            <p className="font-medium">{peserta.outletName}</p>
                                            <p className="text-xs text-muted-foreground">{peserta.outletCode}</p>
                                        </div>
                                        <button type="button" onClick={() => hapusPeserta(peserta.outletId)} className="text-muted-foreground hover:text-red-600">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline" onClick={saveParticipants} disabled={managementSaving}>
                                <Save className="h-4 w-4" /> Simpan Peserta ({participants.length})
                            </Button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <h2 className="font-bold">Pemenang</h2>
                                <p className="text-sm text-muted-foreground">Format per baris: kode outlet, peringkat, hadiah.</p>
                            </div>
                            <Textarea value={winnersText} onChange={(event) => setWinnersText(event.target.value)} rows={6} placeholder="OUTLET-001,1,Hadiah Utama" />
                            <Button onClick={publishWinners} disabled={managementSaving}>
                                <Award className="h-4 w-4" /> Publikasikan Pemenang
                            </Button>

                            <div className="space-y-2 rounded-md border p-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold">Reward Otomatis (Preview)</h3>
                                    <Button type="button" variant="outline" size="sm" onClick={hitungReward} disabled={rewardsLoading}>
                                        {rewardsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        Hitung Reward
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Dihitung dari leaderboard terbaru (klik Recompute dulu bila perlu) dan aturan reward program. Hasilnya masih bisa diedit sebelum dipublikasikan.
                                </p>
                                {rewardsPreview.length > 0 && (
                                    <>
                                        <div className="max-h-48 space-y-1 overflow-y-auto">
                                            {rewardsPreview.map((row, index) => (
                                                <div key={`${row.outletId}-${row.ruleId}-${index}`} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1.5 text-sm">
                                                    <div>
                                                        <p className="font-medium">{row.outletName}</p>
                                                        <p className="text-xs text-muted-foreground">{row.outletCode}</p>
                                                    </div>
                                                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold ring-1 ring-gray-200">{row.rewardLabel}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={isiKePemenang}>Isi ke Pemenang</Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
