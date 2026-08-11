"use client";

import React from "react";
import {
    Award,
    ClipboardCheck,
    Download,
    Flag,
    Loader2,
    Plus,
    RefreshCw,
    Save,
    Search,
    Sparkles,
    Trash2,
    Upload,
    Users,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TargetType = "OUTLET" | "SALESFORCE";
type MechanismType = "RACING" | "REWARD" | "KPI";
type GroupBy = "NONE" | "TAP" | "KABUPATEN" | "KECAMATAN";

interface ProgramParam {
    id: string;
    key: string;
    label: string;
    unit: string | null;
    weight: string;
    aggregation: "SUM" | "AVG" | "LAST";
    isScored: boolean;
    kpiCategory: "NONE" | "COMPLIANCE" | "PERFORMANCE";
    achievementCap: string | null;
    polarity: "HIGHER_BETTER" | "LOWER_BETTER";
}

interface RewardRule {
    id: string;
    rankFrom: number | null;
    rankTo: number | null;
    paramKey: string | null;
    comparator: string | null;
    thresholdValue: string | null;
    rewardLabel: string;
    scoreSource: "TOTAL" | "COMPLIANCE" | "PERFORMANCE" | null;
    benefitType: "REWARD" | "PUNISHMENT" | "NONE" | null;
}

interface Program {
    id: string;
    name: string;
    slug: string;
    targetType: TargetType;
    mechanismType: MechanismType;
    groupBy: GroupBy;
    thumbnailUrl: string | null;
    descriptionMd: string | null;
    mechanismMd: string | null;
    periodStart: string;
    periodEnd: string;
    status: string;
    isPublic: boolean;
    params?: ProgramParam[];
    rewardRules?: RewardRule[];
    kpiComplianceMinScore: string | null;
    kpiDefaultCap: string | null;
    kpiHidePunishment: boolean;
}

interface KpiResultRow {
    participantKey: string;
    salesforceId: string;
    salesforceName: string;
    tap: string;
    complianceScore: string;
    performanceScore: string;
    compliancePassed: boolean;
    benefitType: "NONE" | "REWARD" | "PUNISHMENT";
    benefitLabel: string;
}

interface Participant {
    participantKey: string;
    id: string;
    code: string;
    name: string;
    area: string;
}

interface RewardPreviewRow {
    participantKey: string;
    code: string;
    name: string;
    rank: number | null;
    groupKey: string;
    rewardLabel: string;
    ruleId: string;
}

interface MasterOption {
    id: string;
    name: string;
}

interface UploadResult {
    mode?: string;
    rowCount?: number;
    validCount?: number;
    imported?: number;
    errors?: { row: number; message: string }[];
}

/**
 * Satu baris = satu parameter: `key, label, bobot, agregasi`. Menuliskan INFO di salah
 * satu kolom menandai parameter itu hanya untuk ditampilkan -- angkanya tetap diunggah
 * dan muncul di tabel, tetapi tidak ikut menentukan peringkat. Dipakai untuk menunjukkan
 * tahapan sebuah alur ketika yang diadu hanya hasil akhirnya.
 */
function parseParams(text: string, mechanismType: MechanismType = "RACING") {
    return text.split("\n").map((line) => {
        const parts = line.split(",").map((part) => part.trim());
        if (mechanismType === "KPI") {
            const [key, label, category, weight, aggregation, cap, polarity] = parts;
            return {
                key,
                label: label || key,
                kpiCategory: String(category || "").toUpperCase(),
                weight: weight || "0",
                aggregation: (aggregation || "SUM").toUpperCase(),
                achievementCap: cap || null,
                polarity: String(polarity || "HIGHER").toUpperCase().startsWith("LOWER") ? "LOWER_BETTER" : "HIGHER_BETTER",
                isScored: true,
            };
        }
        const isScored = !parts.some((part) => part.toUpperCase() === "INFO");
        const [key, label, weight, aggregation] = parts.filter((part) => part.toUpperCase() !== "INFO");
        return {
            key,
            label: label || key,
            weight: weight || "1",
            aggregation: (aggregation || "SUM").toUpperCase(),
            isScored,
        };
    }).filter((param) => param.key);
}

function formatParams(params: ProgramParam[], mechanismType: MechanismType = "RACING") {
    if (mechanismType === "KPI") return params.map((param) => [
        param.key, param.label, param.kpiCategory, param.weight, param.aggregation,
        param.achievementCap || "", param.polarity === "LOWER_BETTER" ? "LOWER" : "HIGHER",
    ].join(",")).join("\n");
    return params.map((param) => [
        param.key,
        param.label,
        param.weight,
        param.aggregation,
        param.isScored ? "" : "INFO",
    ].filter(Boolean).join(",")).join("\n");
}

/** Racing: "1,1,Motor". Reward: "omzet,>=,5000000,Voucher" (parameter kosong = total poin). */
function parseRewardRules(text: string, mechanismType: MechanismType) {
    return text.split("\n").map((line) => {
        const parts = line.split(",").map((part) => part.trim());
        if (mechanismType === "RACING") {
            const [rankFrom, rankTo, ...label] = parts;
            return {
                rankFrom: Number(rankFrom) || null,
                rankTo: Number(rankTo) || Number(rankFrom) || null,
                rewardLabel: label.join(",").trim(),
            };
        }
        if (mechanismType === "KPI") {
            const [scoreSource, comparator, thresholdValue, benefitType, ...label] = parts;
            return {
                scoreSource: String(scoreSource || "PERFORMANCE").toUpperCase(),
                comparator: comparator || ">=",
                thresholdValue: thresholdValue || "0",
                benefitType: String(benefitType || "NONE").toUpperCase(),
                rewardLabel: label.join(",").trim(),
            };
        }
        const [paramKey, comparator, thresholdValue, ...label] = parts;
        return {
            paramKey: paramKey || null,
            comparator: comparator || ">=",
            thresholdValue: thresholdValue || "0",
            rewardLabel: label.join(",").trim(),
        };
    }).filter((rule) => rule.rewardLabel);
}

function formatRewardRules(rules: RewardRule[], mechanismType: MechanismType) {
    return rules.map((rule) => mechanismType === "RACING"
        ? `${rule.rankFrom ?? ""},${rule.rankTo ?? ""},${rule.rewardLabel}`
        : mechanismType === "KPI"
            ? `${rule.scoreSource || "PERFORMANCE"},${rule.comparator || ">="},${rule.thresholdValue || "0"},${rule.benefitType || "NONE"},${rule.rewardLabel}`
        : `${rule.paramKey || ""},${rule.comparator || ">="},${rule.thresholdValue || "0"},${rule.rewardLabel}`
    ).join("\n");
}

const MECHANISM_COPY: Record<MechanismType, { judul: string; ringkas: string; aturan: string; contoh: string }> = {
    RACING: {
        judul: "Racing",
        ringkas: "Peserta diadu; pemenang diambil dari peringkat teratas papan skor.",
        aturan: "Aturan Hadiah — format: dariPeringkat, sampaiPeringkat, hadiah",
        contoh: "1,1,Motor Listrik\n2,3,Smartphone\n4,10,Voucher 500rb",
    },
    REWARD: {
        judul: "Reward",
        ringkas: "Tidak diadu; setiap peserta yang mencapai target mendapat hadiahnya.",
        aturan: "Aturan Hadiah — format: paramKey, pembanding, nilai, hadiah",
        contoh: "omzet,>=,5000000,Voucher 500rb\n,>=,1000,Bonus Total Poin",
    },
    KPI: {
        judul: "KPI",
        ringkas: "Setiap salesforce dinilai terhadap targetnya sendiri; tidak ada peringkat atau juara.",
        aturan: "Aturan Benefit — format: sumber, pembanding, nilai, jenis, label",
        contoh: "COMPLIANCE,<,80,PUNISHMENT,Surat Peringatan - Compliance\nPERFORMANCE,>=,100,REWARD,Rp 100.000\nPERFORMANCE,>=,90,REWARD,Rp 50.000",
    },
};

export function ProgramManager({ targetType }: { targetType: TargetType }) {
    const isSalesforce = targetType === "SALESFORCE";
    const istilahPeserta = isSalesforce ? "Salesforce" : "Outlet";

    const [tab, setTab] = React.useState<MechanismType>("RACING");
    const [programs, setPrograms] = React.useState<Program[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [showForm, setShowForm] = React.useState(false);

    const [selected, setSelected] = React.useState<Program | null>(null);
    const [participants, setParticipants] = React.useState<Participant[]>([]);
    const [selectedParams, setSelectedParams] = React.useState<ProgramParam[]>([]);
    const [paramsText, setParamsText] = React.useState("");
    const [rewardRulesText, setRewardRulesText] = React.useState("");
    const [winnersText, setWinnersText] = React.useState("");
    const [editStatus, setEditStatus] = React.useState("DRAFT");
    const [editIsPublic, setEditIsPublic] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    const [query, setQuery] = React.useState("");
    const [candidates, setCandidates] = React.useState<Participant[]>([]);
    const [searching, setSearching] = React.useState(false);

    const [bulkOpen, setBulkOpen] = React.useState(false);
    const [bulkCodes, setBulkCodes] = React.useState("");
    const [bulkFilter, setBulkFilter] = React.useState({ tap: "", kabupaten: "", kecamatan: "" });
    const [bulkBusy, setBulkBusy] = React.useState(false);
    const [bulkInfo, setBulkInfo] = React.useState<{ added: number; skipped: number; unknown: string[] } | null>(null);
    const [master, setMaster] = React.useState<{ tap: MasterOption[]; kabupaten: MasterOption[]; kecamatan: MasterOption[] }>({
        tap: [], kabupaten: [], kecamatan: [],
    });

    const [file, setFile] = React.useState<File | null>(null);
    const [uploadResult, setUploadResult] = React.useState<UploadResult | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [rewards, setRewards] = React.useState<RewardPreviewRow[]>([]);
    const [kpiResults, setKpiResults] = React.useState<KpiResultRow[]>([]);
    const [targetFile, setTargetFile] = React.useState<File | null>(null);
    const [targetUploadResult, setTargetUploadResult] = React.useState<UploadResult | null>(null);
    const [targetUploading, setTargetUploading] = React.useState(false);

    const [form, setForm] = React.useState({
        name: "",
        descriptionMd: "",
        mechanismMd: "",
        periodStart: "",
        periodEnd: "",
        status: "DRAFT",
        isPublic: false,
        groupBy: "NONE" as GroupBy,
        thumbnailUrl: "",
        paramsText: "omzet,Omzet,1\nakuisisi,Akuisisi,1",
        rewardRulesText: MECHANISM_COPY.RACING.contoh,
        kpiComplianceMinScore: "80",
        kpiDefaultCap: "",
        kpiHidePunishment: true,
    });
    const [uploadingImage, setUploadingImage] = React.useState(false);
    const [editGroupBy, setEditGroupBy] = React.useState<GroupBy>("NONE");
    const [editThumb, setEditThumb] = React.useState("");
    const [editKpiComplianceMinScore, setEditKpiComplianceMinScore] = React.useState("");
    const [editKpiDefaultCap, setEditKpiDefaultCap] = React.useState("");
    const [editKpiHidePunishment, setEditKpiHidePunishment] = React.useState(true);

    /** Key visual program; dipakai sebagai gambar kartu di daftar program publik. */
    const unggahGambar = async (file: File, simpan: (url: string) => void) => {
        setUploadingImage(true);
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        setUploadingImage(false);
        if (res.ok && data.url) simpan(data.url);
        else alert(data.error || "Gagal mengunggah gambar");
    };

    const load = React.useCallback(() => {
        setLoading(true);
        fetch(`/api/admin/mitra/programs?targetType=${targetType}`)
            .then((res) => res.json())
            .then((data) => setPrograms(Array.isArray(data.programs) ? data.programs : []))
            .finally(() => setLoading(false));
    }, [targetType]);

    React.useEffect(() => { load(); }, [load]);

    // Contoh aturan ikut berganti saat tab pindah, karena format barisnya memang berbeda
    // antara racing dan reward.
    React.useEffect(() => {
        setForm((prev) => ({
            ...prev,
            rewardRulesText: MECHANISM_COPY[tab].contoh,
            paramsText: tab === "KPI"
                ? "visit_pjp,Visit Sesuai PJP,COMPLIANCE,,AVG,100,HIGHER\nsales_perdana,Sales Perdana,PERFORMANCE,100,SUM,120,HIGHER"
                : prev.paramsText,
            groupBy: tab === "KPI" ? "NONE" : prev.groupBy,
        }));
    }, [tab]);

    // Daftar wilayah untuk filter tambah massal; dipakai bersama outlet dan salesforce.
    React.useEffect(() => {
        fetch("/api/admin/mitra/master")
            .then((res) => res.json())
            .then((data) => setMaster({ tap: data.tap || [], kabupaten: data.kabupaten || [], kecamatan: data.kecamatan || [] }))
            .catch(() => undefined);
    }, []);

    React.useEffect(() => {
        if (!query.trim()) { setCandidates([]); return; }
        setSearching(true);
        const timer = setTimeout(() => {
            fetch(`/api/admin/mitra/programs?targetType=${targetType}&participantQuery=${encodeURIComponent(query)}`)
                .then((res) => res.json())
                .then((data) => setCandidates((data.candidates || []).map((row: Omit<Participant, "participantKey">) => ({
                    ...row,
                    participantKey: `${isSalesforce ? "sf" : "outlet"}:${row.id}`,
                }))))
                .finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [query, targetType, isSalesforce]);

    const daftarTampil = programs.filter((program) => program.mechanismType === tab);

    const simpanProgram = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        const params = parseParams(form.paramsText, tab);

        const res = await fetch("/api/admin/mitra/programs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...form,
                targetType,
                mechanismType: tab,
                params,
                rewardRules: parseRewardRules(form.rewardRulesText, tab),
            }),
        });
        setSaving(false);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return alert(data.error || "Gagal menyimpan program");
        }
        setForm((prev) => ({ ...prev, name: "", descriptionMd: "", mechanismMd: "", periodStart: "", periodEnd: "", thumbnailUrl: "" }));
        setShowForm(false);
        load();
    };

    const bukaKelola = async (programId: string) => {
        const res = await fetch(`/api/admin/mitra/programs/${programId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || "Gagal memuat program");

        setSelected(data.program);
        setSelectedParams(data.params || []);
        setParamsText(formatParams(data.params || [], data.program.mechanismType));
        setParticipants(data.participants || []);
        setRewardRulesText(formatRewardRules(data.rewardRules || [], data.program.mechanismType));
        setWinnersText((data.winners || []).map((w: { code: string; rank: number; prizeLabel?: string | null }) => `${w.code},${w.rank},${w.prizeLabel || ""}`).join("\n"));
        setEditStatus(data.program.status);
        setEditIsPublic(Boolean(data.program.isPublic));
        setEditGroupBy(data.program.groupBy || "NONE");
        setEditThumb(data.program.thumbnailUrl || "");
        setQuery("");
        setCandidates([]);
        setRewards([]);
        setKpiResults(data.kpiResults || []);
        setEditKpiComplianceMinScore(data.program.kpiComplianceMinScore || "");
        setEditKpiDefaultCap(data.program.kpiDefaultCap || "");
        setEditKpiHidePunishment(Boolean(data.program.kpiHidePunishment));
        setTargetFile(null);
        setTargetUploadResult(null);
        setUploadResult(null);
        setFile(null);
    };

    const kirimKelola = async (payload: Record<string, unknown>, sukses: string) => {
        if (!selected) return null;
        setBusy(true);
        const res = await fetch(`/api/admin/mitra/programs/${selected.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) { alert(data.error || "Gagal menyimpan"); return null; }
        if (sukses) alert(sukses);
        return data;
    };

    /**
     * Menambahkan banyak peserta sekaligus, dari daftar kode yang ditempel atau dari filter
     * wilayah. Hasilnya digabung ke daftar yang sedang tampil (peserta yang sudah ada
     * dilewati, bukan digandakan) dan baru tersimpan setelah admin menekan Simpan Peserta.
     */
    const tambahMassal = async (payload: Record<string, unknown>) => {
        if (!selected) return;
        setBulkBusy(true);
        setBulkInfo(null);
        const res = await fetch(`/api/admin/mitra/programs/${selected.id}/participants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        setBulkBusy(false);
        if (!res.ok) return alert(data.error || "Gagal mencari peserta");

        const kandidat: Omit<Participant, "participantKey">[] = data.candidates || [];
        let ditambah = 0;
        let dilewati = 0;
        setParticipants((prev) => {
            const sudahAda = new Set(prev.map((item) => item.id));
            const baru = kandidat
                .filter((item) => {
                    if (sudahAda.has(item.id)) { dilewati += 1; return false; }
                    sudahAda.add(item.id);
                    ditambah += 1;
                    return true;
                })
                .map((item) => ({ ...item, participantKey: `${isSalesforce ? "sf" : "outlet"}:${item.id}` }));
            return [...prev, ...baru];
        });
        setBulkInfo({ added: ditambah, skipped: dilewati, unknown: data.unknown || [] });
    };

    const unggahPencapaian = async (mode: "preview" | "commit") => {
        if (!selected || !file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("mode", mode);
        const res = await fetch(`/api/admin/mitra/programs/${selected.id}/scores`, { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        setUploading(false);
        setUploadResult(data);
        if (res.ok && mode === "commit") load();
    };

    const unggahTarget = async (mode: "preview" | "commit") => {
        if (!selected || !targetFile) return;
        setTargetUploading(true);
        const fd = new FormData();
        fd.append("file", targetFile);
        fd.append("mode", mode);
        const res = await fetch(`/api/admin/mitra/programs/${selected.id}/kpi-targets`, { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        setTargetUploading(false);
        setTargetUploadResult(data);
        if (!res.ok) alert(data.error || "Gagal memproses target KPI");
    };

    const hitungReward = async () => {
        if (!selected) return;
        setBusy(true);
        const res = await fetch("/api/admin/mitra/programs", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "compute_rewards", programId: selected.id }),
        });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return alert(data.error || "Gagal menghitung hadiah");
        setRewards(data.rewards || []);
        if ((data.rewards || []).length === 0) {
            alert("Belum ada peserta yang cocok. Pastikan pencapaian sudah diupload dan papan skor sudah dihitung ulang.");
        }
    };

    const hapusProgram = async (program: Program) => {
        if (!confirm(`Hapus program "${program.name}"? Seluruh peserta, pencapaian, papan skor, dan pemenang ikut terhapus dan tidak bisa dikembalikan.`)) return;
        const res = await fetch(`/api/admin/mitra/programs/${program.id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return alert(data.error || "Gagal menghapus program");
        }
        if (selected?.id === program.id) setSelected(null);
        load();
    };

    const copy = MECHANISM_COPY[tab];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Program {istilahPeserta}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Susun aturan di awal, unggah pencapaian tiap hari, papan skor dan hadiah dihitung otomatis.
                    </p>
                </div>
                <Button onClick={() => setShowForm((prev) => !prev)}>
                    <Plus className="h-4 w-4" />
                    {showForm ? "Tutup Form" : `Program ${copy.judul} Baru`}
                </Button>
            </div>

            <div className="inline-flex rounded-lg border bg-white p-1">
                {(["RACING", "REWARD", ...(isSalesforce ? ["KPI" as const] : [])] as MechanismType[]).map((jenis) => (
                    <button
                        key={jenis}
                        type="button"
                        onClick={() => { setTab(jenis); setSelected(null); }}
                        className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                            tab === jenis ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                        {jenis === "RACING" ? <Flag className="h-4 w-4" /> : jenis === "KPI" ? <ClipboardCheck className="h-4 w-4" /> : <Award className="h-4 w-4" />}
                        {MECHANISM_COPY[jenis].judul}
                    </button>
                ))}
            </div>
            <p className="-mt-3 text-sm text-muted-foreground">{copy.ringkas}</p>

            {showForm && (
                <Card>
                    <CardContent className="p-5">
                        <form onSubmit={simpanProgram} className="grid gap-3 lg:grid-cols-4">
                            <div className="space-y-2 lg:col-span-2">
                                <Label>Nama Program</Label>
                                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Mulai</Label>
                                <Input type="date" value={form.periodStart} onChange={(e) => setForm((p) => ({ ...p, periodStart: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Selesai</Label>
                                <Input type="date" value={form.periodEnd} onChange={(e) => setForm((p) => ({ ...p, periodEnd: e.target.value }))} />
                            </div>
                            <div className="space-y-2 lg:col-span-2">
                                <Label>Key Visual Program</Label>
                                <div className="flex items-center gap-3">
                                    {form.thumbnailUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={form.thumbnailUrl} alt="Key visual" className="h-16 w-24 rounded-md border object-cover" />
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const berkas = e.target.files?.[0];
                                            if (berkas) unggahGambar(berkas, (url) => setForm((p) => ({ ...p, thumbnailUrl: url })));
                                        }}
                                        className="block h-10 flex-1 rounded-md border px-3 py-2 text-sm"
                                    />
                                    {uploadingImage && <Loader2 className="h-4 w-4 animate-spin" />}
                                </div>
                                <p className="text-xs text-muted-foreground">Tampil sebagai gambar kartu program di halaman publik.</p>
                            </div>
                            {tab !== "KPI" && <div className="space-y-2">
                                <Label>Bagi Peringkat Per</Label>
                                <select value={form.groupBy} onChange={(e) => setForm((p) => ({ ...p, groupBy: e.target.value as GroupBy }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="NONE">Tanpa pembagian (satu papan)</option>
                                    <option value="TAP">TAP</option>
                                    {!isSalesforce && <option value="KABUPATEN">Kabupaten</option>}
                                    {!isSalesforce && <option value="KECAMATAN">Kecamatan</option>}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Kalau dipilih, peringkat dihitung terpisah di tiap wilayah — aturan &quot;juara 1&quot; jadi
                                    menghasilkan satu pemenang per wilayah.
                                </p>
                            </div>}
                            {tab === "KPI" && (
                                <>
                                    <div className="space-y-2"><Label>Ambang Compliance (%)</Label><Input type="number" min="0" step="0.01" value={form.kpiComplianceMinScore} onChange={(e) => setForm((p) => ({ ...p, kpiComplianceMinScore: e.target.value }))} /></div>
                                    <div className="space-y-2"><Label>Batas Achievement bawaan</Label><select value={form.kpiDefaultCap} onChange={(e) => setForm((p) => ({ ...p, kpiDefaultCap: e.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm"><option value="">Tanpa batas (loss)</option><option value="100">100%</option><option value="110">110%</option><option value="120">120%</option></select></div>
                                    <label className="flex items-end gap-2 pb-2 text-sm lg:col-span-2"><input type="checkbox" checked={form.kpiHidePunishment} onChange={(e) => setForm((p) => ({ ...p, kpiHidePunishment: e.target.checked }))} /> Sembunyikan label punishment di halaman publik</label>
                                </>
                            )}
                            <div className="space-y-2 lg:col-span-2">
                                <Label>Deskripsi Publik</Label>
                                <Textarea rows={3} value={form.descriptionMd} onChange={(e) => setForm((p) => ({ ...p, descriptionMd: e.target.value }))} />
                            </div>
                            <div className="space-y-2 lg:col-span-2">
                                <Label>Mekanisme (tampil di halaman publik)</Label>
                                <Textarea rows={3} value={form.mechanismMd} onChange={(e) => setForm((p) => ({ ...p, mechanismMd: e.target.value }))} />
                            </div>
                            <div className="space-y-2 lg:col-span-2">
                                <Label>{tab === "KPI" ? "Parameter — format: key, label, kategori, bobot, agregasi, cap, polaritas" : "Parameter Penilaian — format: key, label, bobot, agregasi"}</Label>
                                <Textarea rows={4} value={form.paramsText} onChange={(e) => setForm((p) => ({ ...p, paramsText: e.target.value }))} />
                                {tab !== "KPI" && <p className="text-xs text-muted-foreground">
                                    Bobot otomatis dikalikan ke setiap pencapaian yang diunggah. Agregasi: SUM (dijumlah),
                                    AVG (rata-rata), LAST (ambil tanggal terbaru) — kosongkan untuk SUM.
                                </p>}
                                {tab !== "KPI" && <p className="text-xs text-muted-foreground">
                                    Tambahkan <code>INFO</code> di akhir baris untuk parameter yang hanya ditampilkan di
                                    tabel tanpa ikut dihitung — mis. <code>beli_mitra,Pembelian via Mitra,,,INFO</code>.
                                    Berguna untuk memperlihatkan tahapan alur ketika yang diadu hanya hasil akhirnya.
                                </p>}
                                {tab === "KPI" && (() => {
                                    const parsed = parseParams(form.paramsText, "KPI");
                                    const compliance = parsed.filter((param) => param.kpiCategory === "COMPLIANCE").length;
                                    const performance = parsed.filter((param) => param.kpiCategory === "PERFORMANCE");
                                    const weight = performance.reduce((sum, param) => sum + Number(param.weight || 0), 0);
                                    return <p className={`text-xs ${weight === 100 ? "text-green-700" : "text-amber-700"}`}>{compliance} compliance · {performance.length} performance · total bobot performance {weight}%{weight !== 100 ? " (disarankan 100%)" : ""}</p>;
                                })()}
                            </div>
                            <div className="space-y-2 lg:col-span-2">
                                <Label>{copy.aturan}</Label>
                                <Textarea rows={4} value={form.rewardRulesText} onChange={(e) => setForm((p) => ({ ...p, rewardRulesText: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                    <option value="DRAFT">DRAFT</option>
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="ENDED">ENDED</option>
                                </select>
                            </div>
                            <label className="flex items-end gap-2 pb-2 text-sm">
                                <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm((p) => ({ ...p, isPublic: e.target.checked }))} />
                                Tampilkan publik
                            </label>
                            <Button disabled={saving} className="lg:col-span-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Simpan Program {copy.judul}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-5">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Program</TableHead>
                                <TableHead>Periode</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Parameter</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                            ) : daftarTampil.length ? daftarTampil.map((program) => (
                                <TableRow key={program.id} className={selected?.id === program.id ? "bg-red-50/50" : undefined}>
                                    <TableCell>
                                        <p className="font-semibold">{program.name}</p>
                                        <p className="text-xs text-muted-foreground">{program.slug}</p>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {new Date(program.periodStart).toLocaleDateString("id-ID")} – {new Date(program.periodEnd).toLocaleDateString("id-ID")}
                                    </TableCell>
                                    <TableCell className="text-sm">{program.status}{program.isPublic ? " · Publik" : ""}</TableCell>
                                    <TableCell>{program.params?.length || 0}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-wrap justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => bukaKelola(program.id)}>Kelola</Button>
                                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => hapusProgram(program)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Belum ada program {copy.judul.toLowerCase()}.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {selected && (
                <Card>
                    <CardContent className="space-y-5 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                            <div>
                                <h2 className="text-lg font-bold">{selected.name}</h2>
                                <p className="text-sm text-muted-foreground">{MECHANISM_COPY[selected.mechanismType].judul} · {participants.length} peserta</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                                <X className="h-4 w-4" /> Tutup
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Status</Label>
                                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="h-10 rounded-md border px-3 text-sm">
                                    <option value="DRAFT">DRAFT</option>
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="ENDED">ENDED</option>
                                    <option value="PUBLISHED">PUBLISHED</option>
                                </select>
                            </div>
                            {selected.mechanismType === "KPI" && (
                                <>
                                    <div className="space-y-1"><Label className="text-xs">Ambang Compliance (%)</Label><Input className="w-36" type="number" min="0" step="0.01" value={editKpiComplianceMinScore} onChange={(e) => setEditKpiComplianceMinScore(e.target.value)} /></div>
                                    <div className="space-y-1"><Label className="text-xs">Cap bawaan</Label><select value={editKpiDefaultCap} onChange={(e) => setEditKpiDefaultCap(e.target.value)} className="h-10 rounded-md border px-3 text-sm"><option value="">Tanpa batas</option><option value="100">100%</option><option value="110">110%</option><option value="120">120%</option></select></div>
                                    <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={editKpiHidePunishment} onChange={(e) => setEditKpiHidePunishment(e.target.checked)} /> Sembunyikan punishment publik</label>
                                </>
                            )}
                            {selected.mechanismType !== "KPI" && <div className="space-y-1">
                                <Label className="text-xs">Bagi Peringkat Per</Label>
                                <select value={editGroupBy} onChange={(e) => setEditGroupBy(e.target.value as GroupBy)} className="h-10 rounded-md border px-3 text-sm">
                                    <option value="NONE">Tanpa pembagian</option>
                                    <option value="TAP">TAP</option>
                                    {!isSalesforce && <option value="KABUPATEN">Kabupaten</option>}
                                    {!isSalesforce && <option value="KECAMATAN">Kecamatan</option>}
                                </select>
                            </div>}
                            <div className="space-y-1">
                                <Label className="text-xs">Key Visual</Label>
                                <div className="flex items-center gap-2">
                                    {editThumb && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={editThumb} alt="Key visual" className="h-10 w-16 rounded border object-cover" />
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const berkas = e.target.files?.[0];
                                            if (berkas) unggahGambar(berkas, setEditThumb);
                                        }}
                                        className="block h-10 w-48 rounded-md border px-2 py-2 text-xs"
                                    />
                                    {uploadingImage && <Loader2 className="h-4 w-4 animate-spin" />}
                                </div>
                            </div>
                            <label className="flex items-center gap-2 pb-2 text-sm">
                                <input type="checkbox" checked={editIsPublic} onChange={(e) => setEditIsPublic(e.target.checked)} />
                                Tampilkan publik
                            </label>
                            <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
                                // Mengubah pembagian wilayah mengubah arti peringkat, jadi papan skor
                                // langsung dihitung ulang -- tanpa itu peringkat lama tetap tampil
                                // seolah masih berlaku.
                                const perluHitungUlang = editGroupBy !== selected.groupBy;
                                if (await kirimKelola(
                                    { status: editStatus, isPublic: editIsPublic, groupBy: editGroupBy, thumbnailUrl: editThumb, kpiComplianceMinScore: editKpiComplianceMinScore, kpiDefaultCap: editKpiDefaultCap, kpiHidePunishment: editKpiHidePunishment },
                                    perluHitungUlang ? "" : "Pengaturan tersimpan."
                                )) {
                                    if (perluHitungUlang) {
                                        await fetch("/api/admin/mitra/programs", {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ action: "recompute", programId: selected.id }),
                                        });
                                        alert("Pengaturan tersimpan dan papan skor dihitung ulang mengikuti pembagian wilayah baru.");
                                    }
                                    load();
                                }
                            }}>
                                <Save className="h-4 w-4" /> Simpan Pengaturan
                            </Button>
                            <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
                                setBusy(true);
                                await fetch("/api/admin/mitra/programs", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "recompute", programId: selected.id }),
                                });
                                setBusy(false);
                                alert(selected.mechanismType === "KPI" ? "Hasil KPI dihitung ulang." : "Papan skor dihitung ulang.");
                                if (selected.mechanismType === "KPI") bukaKelola(selected.id);
                            }}>
                                <RefreshCw className="h-4 w-4" /> {selected.mechanismType === "KPI" ? "Hitung Ulang KPI" : "Hitung Ulang Papan Skor"}
                            </Button>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-2">
                            <div className="space-y-3">
                                <div>
                                    <h3 className="font-bold">Peserta</h3>
                                    <p className="text-sm text-muted-foreground">Cari dari database {istilahPeserta.toLowerCase()}, klik untuk menambahkan.</p>
                                </div>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Cari ${istilahPeserta.toLowerCase()}...`} className="pl-9" />
                                    {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                                    {candidates.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
                                            {candidates.map((row) => (
                                                <button
                                                    key={row.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setParticipants((prev) => prev.some((p) => p.id === row.id) ? prev : [...prev, row]);
                                                        setQuery("");
                                                        setCandidates([]);
                                                    }}
                                                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                                                >
                                                    <span className="font-medium">{row.name}</span>
                                                    <span className="text-xs text-muted-foreground">{row.code}{row.area ? ` · ${row.area}` : ""}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="rounded-md border">
                                    <button
                                        type="button"
                                        onClick={() => setBulkOpen((prev) => !prev)}
                                        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold hover:bg-muted"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <Users className="h-4 w-4" /> Tambah Massal
                                        </span>
                                        <span className="text-xs font-normal text-muted-foreground">{bulkOpen ? "Tutup" : "Buka"}</span>
                                    </button>

                                    {bulkOpen && (
                                        <div className="space-y-4 border-t p-3">
                                            <div className="space-y-2">
                                                <Label className="text-xs">
                                                    Tempel {isSalesforce ? "nama salesforce" : "kode outlet"} — satu per baris atau dipisah koma
                                                </Label>
                                                <Textarea
                                                    rows={4}
                                                    value={bulkCodes}
                                                    onChange={(e) => setBulkCodes(e.target.value)}
                                                    placeholder={isSalesforce ? "Budi Santoso\nSiti Aminah" : "2201055482\n2201043676"}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={bulkBusy || !bulkCodes.trim()}
                                                    onClick={() => tambahMassal({ codes: bulkCodes })}
                                                >
                                                    {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah dari Daftar
                                                </Button>
                                            </div>

                                            <div className="space-y-2 border-t pt-3">
                                                <Label className="text-xs">Atau tambah semua yang cocok dengan wilayah</Label>
                                                <div className="grid gap-2 sm:grid-cols-3">
                                                    <select
                                                        value={bulkFilter.tap}
                                                        onChange={(e) => setBulkFilter((p) => ({ ...p, tap: e.target.value }))}
                                                        className="h-9 rounded-md border px-2 text-sm"
                                                    >
                                                        <option value="">Semua TAP</option>
                                                        {master.tap.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                                                    </select>
                                                    {!isSalesforce && (
                                                        <>
                                                            <select
                                                                value={bulkFilter.kabupaten}
                                                                onChange={(e) => setBulkFilter((p) => ({ ...p, kabupaten: e.target.value }))}
                                                                className="h-9 rounded-md border px-2 text-sm"
                                                            >
                                                                <option value="">Semua Kabupaten</option>
                                                                {master.kabupaten.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                                                            </select>
                                                            <select
                                                                value={bulkFilter.kecamatan}
                                                                onChange={(e) => setBulkFilter((p) => ({ ...p, kecamatan: e.target.value }))}
                                                                className="h-9 rounded-md border px-2 text-sm"
                                                            >
                                                                <option value="">Semua Kecamatan</option>
                                                                {master.kecamatan.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                                                            </select>
                                                        </>
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={bulkBusy}
                                                    onClick={() => tambahMassal(bulkFilter)}
                                                >
                                                    {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                                    Tambah Semua {istilahPeserta} yang Cocok
                                                </Button>
                                                <p className="text-xs text-muted-foreground">
                                                    Tanpa memilih filter apa pun, tombol ini menambahkan seluruh {istilahPeserta.toLowerCase()} aktif.
                                                </p>
                                            </div>

                                            {bulkInfo && (
                                                <div className="rounded bg-muted/60 p-2 text-xs">
                                                    <p className="font-semibold">
                                                        {bulkInfo.added} ditambahkan
                                                        {bulkInfo.skipped > 0 ? `, ${bulkInfo.skipped} sudah ada` : ""}.
                                                        Tekan Simpan Peserta untuk menyimpannya.
                                                    </p>
                                                    {bulkInfo.unknown.length > 0 && (
                                                        <p className="mt-1 text-red-700">
                                                            Tidak ditemukan: {bulkInfo.unknown.slice(0, 20).join(", ")}
                                                            {bulkInfo.unknown.length > 20 ? ` dan ${bulkInfo.unknown.length - 20} lainnya` : ""}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                                    {participants.length === 0 && <p className="p-2 text-sm text-muted-foreground">Belum ada peserta.</p>}
                                    {/* Daftar panjang dipotong di layar: seribu baris DOM membuat panel
                                        tersendat, sedangkan yang perlu dipastikan admin cuma jumlahnya. */}
                                    {participants.slice(0, 100).map((row) => (
                                        <div key={row.id} className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted">
                                            <div>
                                                <p className="font-medium">{row.name}</p>
                                                <p className="text-xs text-muted-foreground">{row.code}</p>
                                            </div>
                                            <button type="button" onClick={() => setParticipants((prev) => prev.filter((p) => p.id !== row.id))} className="text-muted-foreground hover:text-red-600">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {participants.length > 100 && (
                                        <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                            dan {participants.length - 100} peserta lain (tidak ditampilkan agar panel tetap ringan).
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" disabled={busy} onClick={() => kirimKelola(
                                        { action: "configure_participants", codes: participants.map((p) => p.code) },
                                        "Peserta tersimpan."
                                    )}>
                                        <Save className="h-4 w-4" /> Simpan Peserta ({participants.length})
                                    </Button>
                                    {participants.length > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700"
                                            onClick={() => {
                                                if (confirm(`Kosongkan daftar ${participants.length} peserta? Tekan Simpan Peserta setelahnya agar perubahan tersimpan.`)) {
                                                    setParticipants([]);
                                                    setBulkInfo(null);
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" /> Kosongkan
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {selected.mechanismType === "KPI" && <div className="space-y-3">
                                <div><h3 className="font-bold">Target KPI</h3><p className="text-sm text-muted-foreground">Target per Salesforce dan parameter. Unduh template, periksa, lalu simpan.</p></div>
                                <Button variant="outline" size="sm" onClick={() => window.open(`/api/admin/mitra/programs/${selected.id}/kpi-targets`, "_blank")}><Download className="h-4 w-4" /> Unduh Template Target</Button>
                                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { setTargetFile(e.target.files?.[0] || null); setTargetUploadResult(null); }} className="block h-10 w-full rounded-md border px-3 py-2 text-sm" />
                                <div className="flex gap-2"><Button variant="outline" size="sm" disabled={!targetFile || targetUploading} onClick={() => unggahTarget("preview")}>{targetUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Periksa Target</Button><Button size="sm" disabled={!targetFile || targetUploading} onClick={() => unggahTarget("commit")}><Upload className="h-4 w-4" /> Simpan Target</Button></div>
                                {targetUploadResult && <div className="rounded-md border p-3 text-sm"><p className="font-semibold">{targetUploadResult.imported !== undefined ? `${targetUploadResult.imported} target tersimpan.` : `${targetUploadResult.validCount || 0} dari ${targetUploadResult.rowCount || 0} baris siap disimpan.`}</p>{targetUploadResult.errors?.length ? <div className="mt-2 max-h-40 overflow-y-auto rounded bg-red-50 p-2 text-xs text-red-700">{targetUploadResult.errors.slice(0, 25).map((error) => <p key={`${error.row}-${error.message}`}>Baris {error.row}: {error.message}</p>)}</div> : null}</div>}
                            </div>}

                            <div className="space-y-3">
                                <div>
                                    <h3 className="font-bold">Unggah Pencapaian</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Satu baris = satu {selected.mechanismType === "KPI" ? "outlet" : "peserta"}, satu parameter, satu tanggal. Unggah ulang tanggal yang sama
                                        akan menimpa nilainya, jadi aman dikirim tiap hari sampai periode berakhir.
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => window.open(`/api/admin/mitra/programs/${selected.id}/scores`, "_blank")}>
                                    <Download className="h-4 w-4" /> Unduh Template
                                </Button>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={(e) => { setFile(e.target.files?.[0] || null); setUploadResult(null); }}
                                    className="block h-10 w-full rounded-md border px-3 py-2 text-sm"
                                />
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" disabled={!file || uploading} onClick={() => unggahPencapaian("preview")}>
                                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Periksa
                                    </Button>
                                    <Button size="sm" disabled={!file || uploading} onClick={() => unggahPencapaian("commit")}>
                                        <Upload className="h-4 w-4" /> Simpan Pencapaian
                                    </Button>
                                </div>
                                {uploadResult && (
                                    <div className="rounded-md border p-3 text-sm">
                                        <p className="font-semibold">
                                            {uploadResult.imported !== undefined
                                                ? `${uploadResult.imported} baris tersimpan, papan skor sudah dihitung ulang.`
                                                : `${uploadResult.validCount || 0} dari ${uploadResult.rowCount || 0} baris siap disimpan.`}
                                        </p>
                                        {uploadResult.errors && uploadResult.errors.length > 0 && (
                                            <div className="mt-2 max-h-40 overflow-y-auto rounded bg-red-50 p-2 text-xs text-red-700">
                                                {uploadResult.errors.slice(0, 25).map((err) => (
                                                    <p key={`${err.row}-${err.message}`}>Baris {err.row}: {err.message}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-2">
                            <div className="space-y-3">
                                <div>
                                    <h3 className="font-bold">Parameter Penilaian</h3>
                                    <p className="text-xs text-muted-foreground">
                                        {selected.mechanismType === "KPI"
                                            ? "Format: key, label, kategori, bobot, agregasi, cap, polaritas."
                                            : <>Format: key, label, bobot, agregasi. Tambahkan <code>INFO</code> agar parameter hanya tampil di tabel tanpa ikut dihitung.</>}
                                    </p>
                                </div>
                                <Textarea rows={5} value={paramsText} onChange={(e) => setParamsText(e.target.value)} />
                                <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
                                    const baru = parseParams(paramsText, selected.mechanismType);
                                    const keyBaru = new Set(baru.map((param) => param.key));
                                    const hilang = selectedParams.filter((param) => !keyBaru.has(param.key));
                                    if (hilang.length > 0 && !confirm(
                                        `Parameter berikut dihapus dari daftar: ${hilang.map((p) => p.label).join(", ")}.\n\n`
                                        + "Seluruh nilai pencapaian yang sudah diunggah untuk parameter itu ikut terhapus "
                                        + "dan tidak bisa dikembalikan. Lanjutkan?"
                                    )) return;

                                    // Mengubah bobot atau status INFO mengubah nilai poin tiap baris skor,
                                    // jadi papan skor langsung dihitung ulang -- kalau tidak, peringkat lama
                                    // tetap tampil seolah masih memakai aturan yang baru.
                                    if (await kirimKelola({ params: baru }, "")) {
                                        await fetch("/api/admin/mitra/programs", {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ action: "recompute", programId: selected.id }),
                                        });
                                        alert("Parameter tersimpan dan papan skor dihitung ulang.");
                                        bukaKelola(selected.id);
                                    }
                                }}>
                                    <Save className="h-4 w-4" /> Simpan Parameter
                                </Button>
                                {selected.mechanismType === "KPI" && (() => {
                                    const parsed = parseParams(paramsText, "KPI");
                                    const performance = parsed.filter((param) => param.kpiCategory === "PERFORMANCE");
                                    const weight = performance.reduce((sum, param) => sum + Number(param.weight || 0), 0);
                                    return <p className={`text-xs ${weight === 100 ? "text-green-700" : "text-amber-700"}`}>{parsed.filter((param) => param.kpiCategory === "COMPLIANCE").length} compliance · {performance.length} performance · bobot performance {weight}%{weight !== 100 ? " (disarankan 100%)" : ""}</p>;
                                })()}
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <h3 className="font-bold">{MECHANISM_COPY[selected.mechanismType].aturan}</h3>
                                    {selectedParams.length > 0 && selected.mechanismType === "REWARD" && (
                                        <p className="text-xs text-muted-foreground">
                                            paramKey tersedia: {selectedParams.map((p) => p.key).join(", ")} — kosongkan untuk memakai total poin.
                                        </p>
                                    )}
                                </div>
                                <Textarea rows={5} value={rewardRulesText} onChange={(e) => setRewardRulesText(e.target.value)} />
                                {selected.mechanismType === "KPI" && <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">{parseRewardRules(rewardRulesText, "KPI").map((rule, index) => <li key={`${rule.scoreSource}-${rule.thresholdValue}-${index}`}>{rule.scoreSource} {rule.comparator} {rule.thresholdValue} → {rule.benefitType}: {rule.rewardLabel}</li>)}</ol>}
                                <Button variant="outline" size="sm" disabled={busy} onClick={() => kirimKelola(
                                    { rewardRules: parseRewardRules(rewardRulesText, selected.mechanismType) },
                                    selected.mechanismType === "KPI" ? "Aturan benefit tersimpan." : "Aturan hadiah tersimpan."
                                )}>
                                    <Save className="h-4 w-4" /> Simpan Aturan
                                </Button>
                            </div>

                            {selected.mechanismType !== "KPI" && <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold">Hadiah Otomatis</h3>
                                    <Button variant="outline" size="sm" disabled={busy} onClick={hitungReward}>
                                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Hitung
                                    </Button>
                                </div>
                                {rewards.length > 0 && (
                                    <>
                                        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                                            {rewards.map((row, index) => (
                                                <div key={`${row.participantKey}-${row.ruleId}-${index}`} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1.5 text-sm">
                                                    <div>
                                                        <p className="font-medium">{row.rank ? `#${row.rank} ` : ""}{row.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {row.code}{row.groupKey ? ` · ${row.groupKey}` : ""}
                                                        </p>
                                                    </div>
                                                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold ring-1 ring-gray-200">{row.rewardLabel}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setWinnersText(
                                            rewards.map((row, index) => `${row.code},${row.rank ?? index + 1},${row.rewardLabel}`).join("\n")
                                        )}>
                                            Salin ke Daftar Pemenang
                                        </Button>
                                    </>
                                )}
                                <div>
                                    <h3 className="font-bold">Pemenang</h3>
                                    <p className="text-sm text-muted-foreground">Format per baris: kode peserta, peringkat, hadiah.</p>
                                </div>
                                <Textarea rows={5} value={winnersText} onChange={(e) => setWinnersText(e.target.value)} />
                                <Button disabled={busy} onClick={async () => {
                                    const winners = winnersText.split("\n").map((line) => {
                                        const [code, rank, ...prize] = line.split(",");
                                        return { code: code?.trim(), rank: Number(rank), prizeLabel: prize.join(",").trim() };
                                    }).filter((w) => w.code);
                                    if (await kirimKelola({ action: "publish_winners", winners }, "Pemenang dipublikasikan.")) load();
                                }}>
                                    <Award className="h-4 w-4" /> Publikasikan Pemenang
                                </Button>
                            </div>}

                            {selected.mechanismType === "KPI" && <div className="space-y-3 lg:col-span-2">
                                <div><h3 className="font-bold">Pratinjau Hasil KPI</h3><p className="text-sm text-muted-foreground">Hasil cache terakhir; tekan Hitung Ulang KPI setelah target, aktual, atau aturan berubah.</p></div>
                                <div className="max-w-full overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Salesforce</TableHead><TableHead>TAP</TableHead><TableHead>Compliance</TableHead><TableHead>Gerbang</TableHead><TableHead>Performance</TableHead><TableHead>Benefit</TableHead></TableRow></TableHeader><TableBody>{kpiResults.length ? kpiResults.map((row) => <TableRow key={row.participantKey}><TableCell className="font-medium">{row.salesforceName}</TableCell><TableCell>{row.tap || "(Tanpa TAP)"}</TableCell><TableCell>{Number(row.complianceScore).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%</TableCell><TableCell className={row.compliancePassed ? "text-green-700" : "text-red-700"}>{row.compliancePassed ? "Lolos" : "Tidak lolos"}</TableCell><TableCell>{Number(row.performanceScore).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%</TableCell><TableCell>{row.benefitLabel || "Tanpa benefit"}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">Belum ada hasil. Unggah target dan pencapaian, lalu hitung ulang.</TableCell></TableRow>}</TableBody></Table></div>
                            </div>}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
