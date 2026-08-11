"use client";

import Link from "next/link";
import React from "react";
import { Crosshair, Download, ExternalLink, Loader2, Pencil, Plus, QrCode, Save, Search, Trash2, X } from "lucide-react";

import { ImportPanel } from "@/components/admin/mitra/import-panel";
import { OutletPhotoCard } from "@/components/mitra/outlet-photo-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TombolUrut } from "@/components/ui/sortable-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MITRA_DETAIL_FIELD_GROUPS } from "@/lib/mitra-fields";
import type { MitraPhotoSlotKey } from "@/lib/mitra-outlet-photos";
import { urutkanBaris, useUrutTabel } from "@/lib/use-sort";
import { useAdminScope } from "@/lib/use-admin-scope";
import {
    DEFAULT_OUTLET_BRANDING,
    DEFAULT_OUTLET_CATEGORY,
    DEFAULT_PJP_DAY,
    DEFAULT_PJP_TYPE,
    OUTLET_BRANDINGS,
    OUTLET_CATEGORIES,
    PJP_DAYS,
    PJP_TYPES,
    buildOutletMapsUrl,
} from "@/lib/mitra-outlet-options";

interface MasterOption {
    id: string;
    name: string;
}

interface Outlet {
    id: string;
    outletCode: string;
    publicToken: string;
    name: string;
    ownerName: string;
    ownerPhone: string;
    kabupaten: string;
    kecamatan: string;
    status: string;
}

interface EditLog {
    id: string;
    action: "PHOTO" | "LOCATION";
    actorType: "MITRA" | "ADMIN";
    actorLabel: string;
    createdAt: string;
}

interface SalesforceOption {
    id: string;
    name: string;
    isActive: boolean;
}

export default function AdminMitraOutletPage() {
    const scope = useAdminScope();
    const [outlets, setOutlets] = React.useState<Outlet[]>([]);
    const [salesforces, setSalesforces] = React.useState<SalesforceOption[]>([]);
    const [q, setQ] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [editOutlet, setEditOutlet] = React.useState<Record<string, unknown> | null>(null);
    const [editDetails, setEditDetails] = React.useState<Record<string, Record<string, string | number>>>({});
    const [editSaving, setEditSaving] = React.useState(false);
    // Status simpan ditampilkan menempel di panel dan bertahan sampai penyimpanan berikutnya --
    // alert() hilang begitu ditutup, sehingga hasil kerja lapangan tidak sempat terbaca.
    const [editStatus, setEditStatus] = React.useState<{ ok: boolean; teks: string } | null>(null);
    const [fotoStatus, setFotoStatus] = React.useState<{ ok: boolean; teks: string } | null>(null);
    const [sedangUnggahFoto, setSedangUnggahFoto] = React.useState<MitraPhotoSlotKey | null>(null);
    const [menandaiLokasi, setMenandaiLokasi] = React.useState(false);
    const [lokasiStatus, setLokasiStatus] = React.useState<{ ok: boolean; teks: string } | null>(null);
    const [editLogs, setEditLogs] = React.useState<EditLog[]>([]);
    const editRef = React.useRef<HTMLDivElement>(null);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const { urut, gantiUrut } = useUrutTabel<string>("");
    const [deleting, setDeleting] = React.useState(false);
    const [form, setForm] = React.useState({
        outletCode: "",
        name: "",
        ownerName: "",
        ownerPhone: "",
        tap: "",
        kabupaten: "",
        kecamatan: "",
        category: String(DEFAULT_OUTLET_CATEGORY),
        pjpDay: String(DEFAULT_PJP_DAY),
        pjpType: String(DEFAULT_PJP_TYPE),
        branding: String(DEFAULT_OUTLET_BRANDING),
        salesforceId: "",
    });
    const [master, setMaster] = React.useState<{ tap: MasterOption[]; kabupaten: MasterOption[]; kecamatan: MasterOption[] }>({
        tap: [], kabupaten: [], kecamatan: [],
    });

    // Daftar wilayah dimuat sekali dan dipakai untuk seluruh dropdown di halaman ini,
    // menggantikan input teks bebas yang sebelumnya membuat satu wilayah tertulis
    // bermacam-macam ejaan.
    React.useEffect(() => {
        fetch("/api/admin/mitra/master")
            .then((res) => res.json())
            .then((data) => setMaster({
                tap: data.tap || [],
                kabupaten: data.kabupaten || [],
                kecamatan: data.kecamatan || [],
            }))
            .catch(() => undefined);
    }, []);

    const load = React.useCallback(() => {
        setLoading(true);
        setSelectedIds([]);
        fetch(`/api/admin/mitra/outlets?q=${encodeURIComponent(q)}&pageSize=50`)
            .then((res) => res.json())
            .then((data) => {
                setOutlets(Array.isArray(data.outlets) ? data.outlets : []);
                setSalesforces(Array.isArray(data.salesforces) ? data.salesforces : []);
            })
            .finally(() => setLoading(false));
    }, [q]);

    React.useEffect(() => { load(); }, [load]);

    /**
     * Panel edit dirender di atas tabel dan baru ada setelah datanya dimuat, jadi
     * penggulirannya harus lewat effect -- di dalam handler klik ref-nya masih null.
     *
     * Dibandingkan dengan id yang sebelumnya terbuka, bukan sekadar "editOutlet terisi":
     * mengetik di form ikut mengganti objek editOutlet, dan tanpa perbandingan ini
     * halaman akan melompat ke atas pada setiap ketikan.
     */
    const idTerbukaRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        const id = editOutlet ? String(editOutlet.id) : null;
        if (id && id !== idTerbukaRef.current) {
            editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        idTerbukaRef.current = id;
    }, [editOutlet]);

    const toggleSelected = (id: string) => {
        setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    };

    const deleteOne = async (outlet: Outlet) => {
        if (!window.confirm(`Hapus outlet ${outlet.name} (${outlet.outletCode})? Data detail, performa, dan keikutsertaan program outlet ini ikut terhapus permanen.`)) return;
        const res = await fetch(`/api/admin/mitra/outlets/${outlet.id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal menghapus outlet.");
            return;
        }
        load();
    };

    const deleteSelected = async () => {
        if (!window.confirm(`Hapus ${selectedIds.length} outlet terpilih? Data detail, performa, dan keikutsertaan program outlet tersebut ikut terhapus permanen.`)) return;
        setDeleting(true);
        const res = await fetch("/api/admin/mitra/outlets", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: selectedIds }),
        });
        setDeleting(false);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal menghapus outlet.");
            return;
        }
        load();
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        const res = await fetch("/api/admin/mitra/outlets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setForm({
                outletCode: "", name: "", ownerName: "", ownerPhone: "", tap: "", kabupaten: "", kecamatan: "",
                category: String(DEFAULT_OUTLET_CATEGORY), pjpDay: String(DEFAULT_PJP_DAY),
                pjpType: String(DEFAULT_PJP_TYPE), branding: String(DEFAULT_OUTLET_BRANDING),
                salesforceId: "",
            });
            load();
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal menyimpan outlet");
        }
        setSaving(false);
    };

    const openEdit = async (outletId: string) => {
        const res = await fetch(`/api/admin/mitra/outlets/${outletId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || "Gagal memuat outlet");
        setEditOutlet(data.outlet);
        setEditStatus(null);
        setFotoStatus(null);
        setLokasiStatus(null);
        setEditLogs(Array.isArray(data.editLogs) ? data.editLogs : []);
        setEditDetails({
            sellthruDigiposJson: data.details?.sellthruDigiposJson || {},
            sellthruNotaJson: data.details?.sellthruNotaJson || {},
            rechargeDigiposJson: data.details?.rechargeDigiposJson || {},
        });
    };

    const updateEditField = (key: string, value: string) => {
        setEditOutlet((previous) => previous ? { ...previous, [key]: value } : previous);
    };

    // Pratinjau tautan lokasi mengikuti koordinat yang sedang diketik, sama seperti
    // yang nanti disimpan server.
    const mapsPreview = editOutlet
        ? buildOutletMapsUrl(Number(editOutlet.latitude), Number(editOutlet.longitude))
        : "";

    /**
     * Foto kunjungan disimpan lewat endpoint login yang memeriksa role dan scope outlet.
     * OTP tidak ikut dalam alur ini. Panel dimuat ulang setelah sukses supaya URL dan waktu
     * pembaruan yang terlihat selalu berasal dari database, bukan pratinjau lokal.
     */
    const unggahFoto = async (slot: MitraPhotoSlotKey, file: File) => {
        if (!editOutlet?.id || sedangUnggahFoto) return;

        const id = String(editOutlet.id);
        const formData = new FormData();
        formData.append("slot", slot);
        formData.append("file", file);

        setSedangUnggahFoto(slot);
        setFotoStatus(null);

        try {
            const res = await fetch(`/api/admin/mitra/outlets/${id}/photos`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setFotoStatus({ ok: false, teks: data.error || "Foto gagal diunggah." });
                return;
            }

            await openEdit(id);
            load();
            setFotoStatus({ ok: true, teks: "Foto berhasil diperbarui." });
        } catch {
            setFotoStatus({ ok: false, teks: "Koneksi bermasalah saat mengunggah foto." });
        } finally {
            setSedangUnggahFoto(null);
        }
    };

    /**
     * Role lapangan menyimpan lewat endpoint tersegmentasi, bukan PUT master.
     *
     * Ketiganya dikirim terpisah karena masing-masing punya allowlist field sendiri di
     * server -- itulah yang menjaga agar kebutuhan mengubah nama outlet tidak sekaligus
     * memberi kemampuan menulis TAP, status, atau penugasan salesforce.
     */
    const simpanLewatSegmen = async (id: string) => {
        const outlet = editOutlet as Record<string, unknown>;
        const gagal: string[] = [];

        const kirim = async (jalur: string, muatan: Record<string, unknown>) => {
            const res = await fetch(`/api/admin/mitra/outlets/${id}/${jalur}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(muatan),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                gagal.push(data.error || `Gagal menyimpan ${jalur}`);
            }
        };

        await kirim("profile", {
            name: outlet.name,
            ownerName: outlet.ownerName,
            ownerPhone: outlet.ownerPhone,
            kabupaten: outlet.kabupaten,
            kecamatan: outlet.kecamatan,
            category: outlet.category,
            pjpDay: outlet.pjpDay,
            pjpType: outlet.pjpType,
        });

        await kirim("branding", { branding: outlet.branding });

        // Koordinat sengaja TIDAK ikut di sini. Titik outlet hanya boleh berasal dari GPS
        // perangkat lewat tombol Update Lokasi, yang menyimpannya sendiri beserta ketelitian
        // pembacaannya -- lihat tandaiLokasi().
        return gagal;
    };

    /**
     * Membaca koordinat dari GPS perangkat lalu menyimpannya langsung. Server menolak
     * pembacaan yang ketelitiannya di atas 200 m, karena angka setengah yakin lebih
     * menyesatkan daripada titik yang belum diisi.
     */
    const tandaiLokasi = () => {
        if (!editOutlet?.id) return;
        if (!navigator.geolocation) {
            setLokasiStatus({ ok: false, teks: "Perangkat atau browser ini tidak mendukung penanda lokasi." });
            return;
        }

        const id = String(editOutlet.id);
        setMenandaiLokasi(true);
        setLokasiStatus(null);

        navigator.geolocation.getCurrentPosition(
            async (posisi) => {
                try {
                    const res = await fetch(`/api/admin/mitra/outlets/${id}/location`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            latitude: posisi.coords.latitude,
                            longitude: posisi.coords.longitude,
                            accuracy: posisi.coords.accuracy,
                        }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        setLokasiStatus({ ok: false, teks: data.error || "Lokasi gagal disimpan." });
                        return;
                    }
                    setLokasiStatus({ ok: true, teks: `Lokasi tersimpan (ketelitian ±${Math.round(posisi.coords.accuracy)} m).` });
                    // Panel dimuat ulang supaya koordinat dan tautan Maps yang tampil berasal
                    // dari yang benar-benar tersimpan, bukan dari nilai di layar.
                    await openEdit(id);
                    load();
                } catch {
                    setLokasiStatus({ ok: false, teks: "Koneksi bermasalah saat menyimpan lokasi." });
                } finally {
                    setMenandaiLokasi(false);
                }
            },
            (error) => {
                setMenandaiLokasi(false);
                setLokasiStatus({
                    ok: false,
                    teks: error.code === error.PERMISSION_DENIED
                        ? "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini lalu coba lagi."
                        : "Lokasi tidak terbaca. Pastikan GPS aktif dan Anda berada di depan outlet.",
                });
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const saveEdit = async () => {
        if (!editOutlet?.id) return;
        const id = String(editOutlet.id);
        setEditSaving(true);
        setEditStatus(null);

        if (roleLapangan) {
            const gagal = await simpanLewatSegmen(id);
            setEditSaving(false);
            if (gagal.length > 0) {
                setEditStatus({ ok: false, teks: gagal.join(" · ") });
                return;
            }
            setEditStatus({ ok: true, teks: "Perubahan tersimpan." });
            load();
            return;
        }

        const res = await fetch(`/api/admin/mitra/outlets/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(editOutlet),
        });
        const data = await res.json().catch(() => ({}));
        setEditSaving(false);
        if (!res.ok) {
            setEditStatus({ ok: false, teks: data.error || "Gagal memperbarui outlet" });
            return;
        }
        setEditOutlet(null);
        load();
    };

    const outletsTampil = urutkanBaris(outlets, urut, (outlet, kolom) => {
        if (kolom === "outlet") return outlet.name;
        if (kolom === "wilayah") return outlet.kecamatan;
        if (kolom === "owner") return outlet.ownerName;
        if (kolom === "status") return outlet.status;
        return "";
    });

    // Judul menyebut cakupan yang sebenarnya berlaku, supaya daftar yang pendek terbaca
    // sebagai "memang hanya ini bagian saya" -- bukan sebagai data yang hilang.
    const judul = scope.role === "SALESFORCE" ? "Outlet Binaan Saya"
        : scope.role === "SUPERVISOR" ? "Outlet TAP Saya"
        : "Database Outlet";
    const { roleLapangan, assignmentKurang } = scope;
    const bolehUploadFoto = ["SUPER_ADMIN", "ADMIN_INPUT", "SUPERVISOR", "SALESFORCE"].includes(scope.role || "");
    const namaSalesforceEdit = editOutlet
        ? salesforces.find((item) => item.id === editOutlet.salesforceId)?.name || "—"
        : "—";

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold sm:text-2xl">{judul}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {scope.role === "SALESFORCE"
                            ? `Outlet yang ditugaskan kepada Anda${scope.taps.length > 0 ? ` di ${scope.taps.join(", ")}` : ""}.`
                            : scope.role === "SUPERVISOR"
                                ? `Seluruh outlet pada TAP ${scope.taps.join(", ") || "yang ditugaskan"}.`
                                : "Kelola data outlet mitra, unggah massal, dan token QR publik."}
                    </p>
                </div>
                {!roleLapangan && (
                    <Link href="/admin/mitra/qr">
                        <Button variant="outline">
                            <QrCode className="h-4 w-4" /> Cetak QR Massal
                        </Button>
                    </Link>
                )}
            </div>

            {/* Assignment yang belum lengkap membuat daftar SELALU kosong. Tanpa penjelasan ini
                layarnya terbaca seperti "belum punya outlet", padahal masalahnya di penugasan. */}
            {assignmentKurang && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Akun Anda belum lengkap penugasannya
                    {scope.role === "SALESFORCE" && !scope.hasSalesforce ? " (belum ditautkan ke master Salesforce)" : ""}
                    {scope.taps.length === 0 ? " (belum punya TAP)" : ""}
                    , sehingga belum ada outlet yang bisa ditampilkan. Hubungi Super Admin untuk melengkapinya.
                </p>
            )}

            {!roleLapangan && <ImportPanel
                type="outlet"
                title="Unggah Outlet Massal"
                description="Tambah outlet baru sekaligus memperbarui yang sudah ada. Baris dengan kode outlet yang sudah terdaftar akan diperbarui, sisanya ditambahkan."
                onCommitted={load}
            />}

            {!roleLapangan && (
            <Card>
                <CardContent className="p-5">
                    <form onSubmit={save} className="grid gap-3 md:grid-cols-4">
                        <Field label="Kode Outlet" value={form.outletCode} onChange={(value) => setForm((prev) => ({ ...prev, outletCode: value }))} />
                        <Field label="Nama Outlet" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
                        <Field label="Owner" value={form.ownerName} onChange={(value) => setForm((prev) => ({ ...prev, ownerName: value }))} />
                        <Field label="WA Owner" value={form.ownerPhone} onChange={(value) => setForm((prev) => ({ ...prev, ownerPhone: value }))} />
                        <MasterField label="TAP" options={master.tap} value={form.tap} onChange={(value) => setForm((prev) => ({ ...prev, tap: value }))} />
                        <MasterField label="Kabupaten" options={master.kabupaten} value={form.kabupaten} onChange={(value) => setForm((prev) => ({ ...prev, kabupaten: value }))} />
                        <MasterField label="Kecamatan" options={master.kecamatan} value={form.kecamatan} onChange={(value) => setForm((prev) => ({ ...prev, kecamatan: value }))} />
                        <div className="space-y-2">
                            <Label>Kategori Outlet</Label>
                            <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                {OUTLET_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Hari PJP</Label>
                            <select value={form.pjpDay} onChange={(event) => setForm((prev) => ({ ...prev, pjpDay: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                {PJP_DAYS.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tipe PJP</Label>
                            <select value={form.pjpType} onChange={(event) => setForm((prev) => ({ ...prev, pjpType: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                {PJP_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Branding Outlet</Label>
                            <select value={form.branding} onChange={(event) => setForm((prev) => ({ ...prev, branding: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                {OUTLET_BRANDINGS.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Salesforce</Label>
                            <select value={form.salesforceId} onChange={(event) => setForm((prev) => ({ ...prev, salesforceId: event.target.value }))} className="h-10 w-full rounded-md border px-3 text-sm">
                                <option value="">Tanpa salesforce</option>
                                {salesforces.filter((item) => item.isActive).map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <Button disabled={saving} className="w-full">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Tambah Outlet
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
            )}

            {editOutlet && (
                <Card ref={editRef} className="scroll-mt-20">
                    <CardContent className="space-y-3 p-3 sm:space-y-5 sm:p-5">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h2 className="font-bold leading-tight">Edit {String(editOutlet.name || "Outlet")}</h2>
                                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Profil, lokasi, branding, dan foto outlet.</p>
                            </div>
                            <Button variant="ghost" size="icon" className="-mr-2 -mt-2 shrink-0" onClick={() => setEditOutlet(null)} aria-label="Tutup editor">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {roleLapangan && (
                            <details className="rounded-lg border bg-gray-50 p-3 md:hidden">
                                <summary className="cursor-pointer text-sm font-bold">Identitas &amp; penugasan</summary>
                                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                    {[
                                        ["ID Digipos", editOutlet.outletCode],
                                        ["Nomor RS", editOutlet.rsNumber],
                                        ["TAP", editOutlet.tap],
                                        ["Salesforce", namaSalesforceEdit],
                                        ["Status", editOutlet.status],
                                    ].map(([label, value]) => (
                                        <div key={String(label)} className="min-w-0">
                                            <dt className="text-muted-foreground">{String(label)}</dt>
                                            <dd className="truncate font-semibold text-gray-950">{String(value || "—")}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </details>
                        )}

                        <div className={roleLapangan
                            ? "grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 xl:grid-cols-4"
                            : "grid gap-3 md:grid-cols-3 xl:grid-cols-4"}
                        >
                            {/* Kolom master dikunci untuk role lapangan supaya layar tidak
                                menjanjikan sesuatu yang akan ditolak server -- allowlist
                                endpoint tersegmentasi memang tidak memuat keenamnya. */}
                            {([
                                ["outletCode", "ID Digipos"], ["rsNumber", "Nomor RS"], ["name", "Nama Outlet"], ["ownerName", "Nama Owner"],
                                ["ownerPhone", "Nomor Owner"], ["tap", "TAP (nama cabang)"], ["kabupaten", "Kabupaten"],
                                ["kecamatan", "Kecamatan"], ["longitude", "Longitude"], ["latitude", "Latitude"], ["photoUrl", "URL Foto"],
                            ] as [string, string][]).map(([key, label]) => {
                                // Koordinat punya kontrol GPS tersendiri di bawah; menampilkannya
                                // sebagai isian teks akan mengundang pengetikan manual yang justru
                                // hendak dicegah.
                                if (roleLapangan && (key === "longitude" || key === "latitude")) return null;
                                const terkunci = roleLapangan && ["outletCode", "rsNumber", "tap", "photoUrl"].includes(key);
                                const lebarPenuhMobile = roleLapangan && ["name", "ownerName", "ownerPhone"].includes(key);
                                return (
                                    <Field
                                        key={key}
                                        label={terkunci ? `${label} (dikelola admin)` : label}
                                        value={String(editOutlet[key] ?? "")}
                                        onChange={(value) => updateEditField(key, value)}
                                        disabled={terkunci}
                                        className={[
                                            terkunci ? "hidden md:block" : "",
                                            lebarPenuhMobile ? "col-span-2 md:col-span-1" : "",
                                        ].filter(Boolean).join(" ")}
                                    />
                                );
                            })}
                            {/* Salesforce kini master tersendiri: nama dan fotonya diurus di
                                menu Salesforce, outlet tinggal menautkannya. Foto tidak lagi
                                diunggah per outlet supaya tidak ada dua sumber kebenaran. */}
                            <div className={`space-y-1.5 sm:space-y-2 ${roleLapangan ? "hidden md:block" : ""}`}>
                                <Label>Salesforce</Label>
                                <select
                                    value={String(editOutlet.salesforceId || "")}
                                    onChange={(event) => updateEditField("salesforceId", event.target.value)}
                                    disabled={roleLapangan}
                                    className="h-9 w-full rounded-md border px-2.5 text-sm disabled:bg-gray-100 disabled:text-muted-foreground sm:h-10 sm:px-3"
                                >
                                    <option value="">Tanpa salesforce</option>
                                    {salesforces
                                        .filter((item) => item.isActive || item.id === editOutlet.salesforceId)
                                        .map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}{item.isActive ? "" : " (nonaktif)"}
                                            </option>
                                        ))}
                                </select>
                                {!roleLapangan && (
                                    <Link href="/admin/mitra/salesforce" className="text-xs font-semibold text-red-600 hover:underline">
                                        Kelola nama & foto salesforce
                                    </Link>
                                )}
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <Label>Kategori Outlet</Label>
                                <select value={String(editOutlet.category || DEFAULT_OUTLET_CATEGORY)} onChange={(event) => updateEditField("category", event.target.value)} className="h-9 w-full rounded-md border px-2.5 text-sm sm:h-10 sm:px-3">
                                    {OUTLET_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <Label>Hari PJP</Label>
                                <select value={String(editOutlet.pjpDay || DEFAULT_PJP_DAY)} onChange={(event) => updateEditField("pjpDay", event.target.value)} className="h-9 w-full rounded-md border px-2.5 text-sm sm:h-10 sm:px-3">
                                    {PJP_DAYS.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <Label>Tipe PJP</Label>
                                <select value={String(editOutlet.pjpType || DEFAULT_PJP_TYPE)} onChange={(event) => updateEditField("pjpType", event.target.value)} className="h-9 w-full rounded-md border px-2.5 text-sm sm:h-10 sm:px-3">
                                    {PJP_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                                <p className="hidden text-xs text-muted-foreground sm:block">Jumlah kunjungan wajib salesforce per bulan.</p>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <Label>Branding Outlet</Label>
                                <select value={String(editOutlet.branding || DEFAULT_OUTLET_BRANDING)} onChange={(event) => updateEditField("branding", event.target.value)} className="h-9 w-full rounded-md border px-2.5 text-sm sm:h-10 sm:px-3">
                                    {OUTLET_BRANDINGS.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </div>
                            <div className={`space-y-1.5 sm:space-y-2 ${roleLapangan ? "hidden md:block" : ""}`}>
                                <Label>Status{roleLapangan ? " (dikelola admin)" : ""}</Label>
                                <select value={String(editOutlet.status || "ACTIVE")} onChange={(event) => updateEditField("status", event.target.value)} disabled={roleLapangan} className="h-9 w-full rounded-md border px-2.5 text-sm disabled:bg-gray-100 disabled:text-muted-foreground sm:h-10 sm:px-3">
                                    <option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="SUSPENDED">SUSPENDED</option>
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1.5 sm:space-y-2 md:col-span-2">
                                <Label>Lokasi (Google Maps)</Label>
                                {mapsPreview ? (
                                    <a href={mapsPreview} target="_blank" rel="noreferrer" className="block truncate text-sm text-blue-600 underline">
                                        {mapsPreview}
                                    </a>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        {roleLapangan
                                            ? "Outlet ini belum punya titik lokasi."
                                            : "Isi Longitude dan Latitude untuk membuat tautan otomatis."}
                                    </p>
                                )}
                                <p className="hidden text-xs text-muted-foreground sm:block">Dibuat otomatis dari koordinat, tidak perlu diketik.</p>
                            </div>

                            {/**
                              * Koordinat diambil dari GPS perangkat, bukan diketik. Mengetik
                              * lintang/bujur manual adalah sumber titik outlet yang meleset --
                              * satu digit tertukar sudah memindahkan penanda belasan kilometer,
                              * dan tidak ada cara memverifikasinya dari layar ini.
                              *
                              * Disimpan langsung saat tombol ditekan, terpisah dari tombol Simpan
                              * Perubahan: petugas menekannya sambil berdiri di depan outlet, dan
                              * pembacaan GPS tidak boleh menunggu isian lain selesai diperiksa.
                              */}
                            {roleLapangan && (
                                <div className="col-span-2 space-y-1.5 sm:space-y-2 md:col-span-2">
                                    <Label>Titik Lokasi Outlet</Label>
                                    <div className="rounded-lg border bg-gray-50 p-3">
                                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Koordinat Tersimpan</p>
                                        <p className="mt-1 font-mono text-sm text-gray-950">
                                            {editOutlet.latitude && editOutlet.longitude
                                                ? `${Number(editOutlet.latitude).toFixed(6)}, ${Number(editOutlet.longitude).toFixed(6)}`
                                                : "Belum ditandai"}
                                        </p>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <Button type="button" variant="outline" size="sm" onClick={tandaiLokasi} disabled={menandaiLokasi}>
                                                {menandaiLokasi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                                                {menandaiLokasi ? "Membaca lokasi..." : "Update Lokasi Sekarang"}
                                            </Button>
                                            {lokasiStatus && (
                                                <span
                                                    role="status"
                                                    className={`rounded-lg px-3 py-1.5 text-xs ${lokasiStatus.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                                                >
                                                    {lokasiStatus.teks}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            <span className="sm:hidden">Gunakan di depan outlet; ketelitian di atas 200 m ditolak.</span>
                                            <span className="hidden sm:inline">Tekan tombol ini <strong>saat berada di depan outlet</strong>. Koordinat diambil dari GPS perangkat dan langsung tersimpan; ketelitian di atas 200 m akan ditolak.</span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-950">Data Performance Outlet</p>
                            <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                                Sellthru Digipos, Sellthru Nota, dan Recharge Digipos hanya dapat diperbarui
                                melalui Upload Data oleh admin. Data di halaman ini selalu baca-saja.
                            </p>
                        </div>

                        {MITRA_DETAIL_FIELD_GROUPS.map((group) => (
                            <details key={group.key} className="rounded-lg border bg-gray-50 p-3 sm:p-4">
                                <summary className="cursor-pointer text-sm font-bold sm:text-base">{group.title}</summary>
                                <div className="mt-3 overflow-x-auto rounded-lg border bg-white sm:mt-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Parameter</TableHead>
                                                <TableHead className="text-right">Nilai</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {group.fields.map((field) => {
                                                const value = editDetails[group.storageKey]?.[field.key];
                                                return (
                                                    <TableRow key={field.key}>
                                                        <TableCell className="font-medium">{field.label}</TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {value === undefined || value === null || value === "" ? "—" : String(value)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </details>
                        ))}

                        <OutletPhotoCard
                            outlet={editOutlet}
                            onUpload={bolehUploadFoto ? unggahFoto : undefined}
                            sedangUnggah={sedangUnggahFoto}
                            compactMobile={roleLapangan}
                        />
                        {fotoStatus && (
                            <p
                                role="status"
                                className={`rounded-lg px-3 py-2 text-sm ${fotoStatus.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                            >
                                {fotoStatus.teks}
                            </p>
                        )}

                        {/* Riwayat ini sumbernya sama dengan yang dilihat mitra di halaman
                            detail, jadi admin dan mitra membaca jejak yang persis sama. */}
                        <details className="rounded-lg border bg-gray-50 p-3 sm:p-4">
                            <summary className="cursor-pointer text-sm font-bold sm:text-base">
                                Riwayat Perubahan Foto &amp; Lokasi ({editLogs.length})
                            </summary>
                            {editLogs.length > 0 ? (
                                <ul className="mt-4 space-y-2">
                                    {editLogs.map((log) => (
                                        <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-4 py-2 text-sm">
                                            <span>
                                                <span className="font-semibold">
                                                    {log.action === "PHOTO" ? "Foto diperbarui" : "Lokasi diperbarui"}
                                                </span>
                                                <span className="ml-2 text-muted-foreground">
                                                    oleh {log.actorLabel} ({log.actorType === "ADMIN" ? "admin" : "mitra"})
                                                </span>
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(log.createdAt))}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-4 text-sm text-muted-foreground">Belum ada perubahan yang tercatat.</p>
                            )}
                        </details>

                        <div className={roleLapangan
                            ? "sticky bottom-2 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border bg-white/95 p-2 shadow-lg backdrop-blur sm:static sm:mx-0 sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"
                            : "flex flex-wrap items-center gap-3"}
                        >
                            <Button onClick={saveEdit} disabled={editSaving} className={roleLapangan ? "flex-1 sm:flex-none" : undefined}>
                                {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Simpan Perubahan
                            </Button>
                            {editStatus && (
                                <span
                                    role="status"
                                    className={`rounded-lg px-3 py-2 text-sm ${editStatus.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                                >
                                    {editStatus.teks}
                                </span>
                            )}
                        </div>
                        {roleLapangan && (
                            <p className="hidden text-xs text-muted-foreground sm:block">
                                Kode outlet, Nomor RS, TAP, Salesforce, dan status outlet dikelola admin dan tidak
                                ikut tersimpan dari layar ini.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-5">
                    <div className="mb-4 flex gap-2">
                        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari outlet, kode, wilayah, nomor" />
                        <Button onClick={load} size="icon" aria-label="Cari">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>

                    {selectedIds.length > 0 && !roleLapangan && (
                        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                            <span className="text-sm font-semibold text-red-700">{selectedIds.length} outlet dipilih</span>
                            <Button variant="outline" size="sm" onClick={deleteSelected} disabled={deleting}>
                                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4 text-red-600" />}
                                Hapus terpilih
                            </Button>
                        </div>
                    )}

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <input
                                        type="checkbox"
                                        aria-label="Pilih semua outlet"
                                        className="h-4 w-4 accent-red-600"
                                        checked={outlets.length > 0 && selectedIds.length === outlets.length}
                                        onChange={(event) => setSelectedIds(event.target.checked ? outlets.map((outlet) => outlet.id) : [])}
                                    />
                                </TableHead>
                                <TableHead><TombolUrut kolom="outlet" label="Outlet" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="wilayah" label="Wilayah" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="owner" label="Owner" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead><TombolUrut kolom="status" label="Status" urut={urut} onKlik={gantiUrut} /></TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Memuat...</TableCell></TableRow>
                            ) : outletsTampil.length ? outletsTampil.map((outlet) => (
                                <TableRow key={outlet.id}>
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            aria-label={`Pilih ${outlet.name}`}
                                            className="h-4 w-4 accent-red-600"
                                            checked={selectedIds.includes(outlet.id)}
                                            onChange={() => toggleSelected(outlet.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-semibold">{outlet.name}</p>
                                        <p className="text-xs text-muted-foreground">{outlet.outletCode}</p>
                                    </TableCell>
                                    <TableCell className="text-sm">{outlet.kecamatan}, {outlet.kabupaten}</TableCell>
                                    <TableCell className="text-sm">{outlet.ownerName || "-"}<br /><span className="text-xs text-muted-foreground">{outlet.ownerPhone}</span></TableCell>
                                    <TableCell>{outlet.status}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Link href={`/mitra/o/${outlet.publicToken}`} target="_blank" className="rounded-md border p-2" title="Profil publik">
                                                <ExternalLink className="h-4 w-4" />
                                            </Link>
                                            <button onClick={() => openEdit(outlet.id)} className="rounded-md border p-2" title="Edit outlet" aria-label="Edit outlet">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <Link href={`/api/public/mitra/outlets/${outlet.publicToken}/qr`} target="_blank" className="rounded-md border p-2" title="QR SVG">
                                                <QrCode className="h-4 w-4" />
                                            </Link>
                                            <Link href={`/api/public/mitra/outlets/${outlet.publicToken}/qr?format=card`} target="_blank" className="rounded-md border p-2" title="Kartu QR 90 x 55 mm">
                                                <Download className="h-4 w-4" />
                                            </Link>
                                            <button onClick={() => deleteOne(outlet)} className={`rounded-md border p-2 ${roleLapangan ? "hidden" : ""}`} title="Hapus outlet" aria-label="Hapus outlet">
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Belum ada outlet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function Field({ label, value, onChange, disabled = false, className = "" }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <div className={`space-y-1.5 sm:space-y-2 ${className}`}>
            <Label>{label}</Label>
            <Input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                className={`h-9 sm:h-10 ${disabled ? "bg-gray-100 text-muted-foreground" : ""}`}
            />
        </div>
    );
}

/**
 * Pilihan wilayah dari daftar master. Nilai yang sudah tersimpan tapi tidak ada di master
 * tetap ditampilkan sebagai opsi tambahan -- tanpa itu, membuka outlet lama akan terlihat
 * seolah wilayahnya kosong dan menyimpan ulang akan menghapusnya diam-diam.
 */
function MasterField({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: MasterOption[];
    value: string;
    onChange: (value: string) => void;
}) {
    const adaDiMaster = options.some((option) => option.name === value);

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 w-full rounded-md border px-3 text-sm"
            >
                <option value="">Pilih {label}</option>
                {!adaDiMaster && value && <option value={value}>{value} (di luar daftar)</option>}
                {options.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
            </select>
        </div>
    );
}
