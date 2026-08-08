"use client";

import React from "react";
import { Copy, Image as ImageIcon, Loader2, Plus, Save, Star, Trash2, Type, X } from "lucide-react";

import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    KARTU_LEBAR_MM,
    KARTU_TINGGI_MM,
    QR_FIELDS,
    TEMPLATE_BAWAAN,
    type QrElement,
    type QrFieldKey,
} from "@/lib/qr-template";

/** Perbesaran pratinjau: 1 mm = 4 px, jadi kartunya tampil 360 x 220 px. */
const SKALA = 4;

interface TemplateRow {
    id: string;
    name: string;
    isDefault: boolean;
    backgroundColor: string;
    backgroundImageUrl: string | null;
    logoUrl: string | null;
    logoX: string;
    logoY: string;
    logoWidth: string;
    qrX: string;
    qrY: string;
    qrSize: string;
    elementsJson: QrElement[] | null;
}

interface FormTemplate {
    id: string;
    name: string;
    isDefault: boolean;
    backgroundColor: string;
    backgroundImageUrl: string;
    logoUrl: string;
    logoX: number;
    logoY: number;
    logoWidth: number;
    qrX: number;
    qrY: number;
    qrSize: number;
    elements: QrElement[];
}

const CONTOH = {
    outletName: "135 Cell",
    outletCode: "2201043676",
    tap: "Kuningan",
    kabupaten: "Kuningan",
    kecamatan: "Jalaksana",
    ownerName: "Dani Ramdani",
    url: "https://abkciraya.cloud/mitra/o/contoh",
};

const FORM_BARU: FormTemplate = {
    id: "",
    name: "Template Baru",
    isDefault: false,
    backgroundColor: TEMPLATE_BAWAAN.backgroundColor,
    backgroundImageUrl: "",
    logoUrl: "",
    logoX: TEMPLATE_BAWAAN.logoX,
    logoY: TEMPLATE_BAWAAN.logoY,
    logoWidth: TEMPLATE_BAWAAN.logoWidth,
    qrX: TEMPLATE_BAWAAN.qrX,
    qrY: TEMPLATE_BAWAAN.qrY,
    qrSize: TEMPLATE_BAWAAN.qrSize,
    elements: TEMPLATE_BAWAAN.elements,
};

function labelField(field: QrFieldKey) {
    return QR_FIELDS.find((item) => item.key === field)?.label || field;
}

function isiContoh(element: QrElement) {
    if (element.field === "teks") return element.text || "(tulisan kosong)";
    return String(CONTOH[element.field as keyof typeof CONTOH] || labelField(element.field));
}

export default function AdminQrTemplatePage() {
    const [templates, setTemplates] = React.useState<TemplateRow[]>([]);
    const [form, setForm] = React.useState<FormTemplate>(FORM_BARU);
    const [terpilihId, setTerpilihId] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [unggah, setUnggah] = React.useState<"latar" | "logo" | null>(null);
    const kanvasRef = React.useRef<HTMLDivElement>(null);
    // Elemen yang sedang diseret beserta selisih titik pegang, supaya kartu tidak melompat.
    const seretRef = React.useRef<{ id: string; dx: number; dy: number } | null>(null);

    const load = React.useCallback(() => {
        fetch("/api/admin/mitra/qr-templates")
            .then((res) => res.json())
            .then((data) => setTemplates(Array.isArray(data.templates) ? data.templates : []));
    }, []);

    React.useEffect(() => { load(); }, [load]);

    const pilihTemplate = (row: TemplateRow) => {
        setTerpilihId(row.id);
        setForm({
            id: row.id,
            name: row.name,
            isDefault: row.isDefault,
            backgroundColor: row.backgroundColor,
            backgroundImageUrl: row.backgroundImageUrl || "",
            logoUrl: row.logoUrl || "",
            logoX: Number(row.logoX),
            logoY: Number(row.logoY),
            logoWidth: Number(row.logoWidth),
            qrX: Number(row.qrX),
            qrY: Number(row.qrY),
            qrSize: Number(row.qrSize),
            elements: Array.isArray(row.elementsJson) ? row.elementsJson : [],
        });
    };

    const unggahGambar = async (jenis: "latar" | "logo", file: File) => {
        setUnggah(jenis);
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.url) return alert(data.error || "Gambar gagal diunggah");
            setForm((prev) => jenis === "latar"
                ? { ...prev, backgroundImageUrl: data.url }
                : { ...prev, logoUrl: data.url });
        } finally {
            setUnggah(null);
        }
    };

    const simpan = async () => {
        setSaving(true);
        const res = await fetch("/api/admin/mitra/qr-templates", {
            method: form.id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        const data = await res.json().catch(() => ({}));
        setSaving(false);
        if (!res.ok) return alert(data.error || "Template gagal disimpan");
        setTerpilihId(data.id);
        setForm((prev) => ({ ...prev, id: data.id, isDefault: data.isDefault }));
        load();
    };

    const hapus = async (row: TemplateRow) => {
        if (!window.confirm(`Hapus template "${row.name}"?`)) return;
        const res = await fetch(`/api/admin/mitra/qr-templates?id=${row.id}`, { method: "DELETE" });
        if (!res.ok) return alert("Template gagal dihapus");
        if (terpilihId === row.id) { setForm(FORM_BARU); setTerpilihId(null); }
        load();
    };

    const ubahElemen = (id: string, patch: Partial<QrElement>) => {
        setForm((prev) => ({
            ...prev,
            elements: prev.elements.map((el) => el.id === id ? { ...el, ...patch } : el),
        }));
    };

    const tambahElemen = () => {
        setForm((prev) => ({
            ...prev,
            elements: [...prev.elements, {
                id: `el-${Date.now()}`,
                field: "outletName",
                x: 40,
                y: 30,
                fontSize: 9,
                color: "#171717",
                bold: false,
                maxWidth: 45,
            }],
        }));
    };

    /**
     * Penyeretan memakai pointer event pada kanvas, bukan drag-and-drop HTML5: yang terakhir
     * memerlukan drag image dan tidak bekerja mulus untuk pemindahan bebas, sedangkan
     * pointer event sekaligus menangani layar sentuh.
     */
    const mulaiSeret = (event: React.PointerEvent, id: string, xMm: number, yMm: number) => {
        const kanvas = kanvasRef.current?.getBoundingClientRect();
        if (!kanvas) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        seretRef.current = {
            id,
            dx: (event.clientX - kanvas.left) / SKALA - xMm,
            dy: (event.clientY - kanvas.top) / SKALA - yMm,
        };
    };

    const seret = (event: React.PointerEvent) => {
        const aktif = seretRef.current;
        const kanvas = kanvasRef.current?.getBoundingClientRect();
        if (!aktif || !kanvas) return;

        const x = Math.round(((event.clientX - kanvas.left) / SKALA - aktif.dx) * 10) / 10;
        const y = Math.round(((event.clientY - kanvas.top) / SKALA - aktif.dy) * 10) / 10;
        const batasX = Math.min(Math.max(x, 0), KARTU_LEBAR_MM);
        const batasY = Math.min(Math.max(y, 0), KARTU_TINGGI_MM);

        if (aktif.id === "__qr__") setForm((prev) => ({ ...prev, qrX: batasX, qrY: batasY }));
        else if (aktif.id === "__logo__") setForm((prev) => ({ ...prev, logoX: batasX, logoY: batasY }));
        else ubahElemen(aktif.id, { x: batasX, y: batasY });
    };

    const selesaiSeret = () => { seretRef.current = null; };

    return (
        <div className="space-y-6">
            <BackLink href="/admin/mitra/qr" label="Kembali ke QR Mitra Outlet" />

            <div>
                <h1 className="text-2xl font-bold">Template Kartu QR</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Ukuran kartu tetap {KARTU_LEBAR_MM} x {KARTU_TINGGI_MM} mm. Seret elemen di pratinjau, atau ketik
                    koordinatnya dalam milimeter. Template bertanda bintang dipakai saat mencetak.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                <Card>
                    <CardContent className="space-y-4 p-5">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="min-w-[200px] flex-1 space-y-2">
                                <Label>Nama Template</Label>
                                <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                            </div>
                            <label className="flex h-10 items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-red-600"
                                    checked={form.isDefault}
                                    onChange={(event) => setForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
                                />
                                Jadikan template cetak
                            </label>
                            <Button onClick={simpan} disabled={saving || !form.name.trim()}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {form.id ? "Simpan Perubahan" : "Simpan Template"}
                            </Button>
                        </div>

                        {/* Pratinjau berskala 1 mm = 4 px. Koordinat yang tersimpan tetap mm,
                            jadi mengubah skala di sini tidak menggeser hasil cetak. */}
                        <div
                            ref={kanvasRef}
                            onPointerMove={seret}
                            onPointerUp={selesaiSeret}
                            onPointerLeave={selesaiSeret}
                            className="relative mx-auto touch-none overflow-hidden rounded-lg border-2 border-dashed"
                            style={{
                                width: KARTU_LEBAR_MM * SKALA,
                                height: KARTU_TINGGI_MM * SKALA,
                                background: form.backgroundColor,
                                backgroundImage: form.backgroundImageUrl ? `url(${form.backgroundImageUrl})` : undefined,
                                backgroundSize: "cover",
                            }}
                        >
                            <div
                                onPointerDown={(event) => mulaiSeret(event, "__qr__", form.qrX, form.qrY)}
                                className="absolute cursor-move border-2 border-red-500 bg-white/70 text-center text-[9px] font-bold text-red-600"
                                style={{
                                    left: form.qrX * SKALA,
                                    top: form.qrY * SKALA,
                                    width: form.qrSize * SKALA,
                                    height: form.qrSize * SKALA,
                                    lineHeight: `${form.qrSize * SKALA}px`,
                                }}
                            >
                                QR
                            </div>

                            {form.logoUrl && (
                                <div
                                    onPointerDown={(event) => mulaiSeret(event, "__logo__", form.logoX, form.logoY)}
                                    className="absolute cursor-move border border-blue-400"
                                    style={{ left: form.logoX * SKALA, top: form.logoY * SKALA, width: form.logoWidth * SKALA }}
                                >
                                    {/* Sengaja <img>: sumbernya URL unggahan sembarang dan ini hanya
                                        pratinjau editor, bukan halaman yang dinilai performanya. */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={form.logoUrl} alt="Logo" className="w-full" />
                                </div>
                            )}

                            {form.elements.map((element) => (
                                <div
                                    key={element.id}
                                    onPointerDown={(event) => mulaiSeret(event, element.id, element.x, element.y)}
                                    className="absolute cursor-move whitespace-nowrap border border-dashed border-transparent hover:border-gray-400"
                                    style={{
                                        left: element.x * SKALA,
                                        top: element.y * SKALA,
                                        // px = pt pada skala 4 px/mm: 1 pt = 0,3528 mm x 4 px/mm.
                                        fontSize: element.fontSize * 1.41,
                                        color: element.color,
                                        fontWeight: element.bold ? 700 : 400,
                                    }}
                                >
                                    {isiContoh(element)}
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Angka label="QR X (mm)" nilai={form.qrX} onChange={(v) => setForm((p) => ({ ...p, qrX: v }))} />
                            <Angka label="QR Y (mm)" nilai={form.qrY} onChange={(v) => setForm((p) => ({ ...p, qrY: v }))} />
                            <Angka label="Ukuran QR (mm)" nilai={form.qrSize} onChange={(v) => setForm((p) => ({ ...p, qrSize: v }))} />
                            <div className="space-y-2">
                                <Label>Warna Latar</Label>
                                <Input type="color" value={form.backgroundColor} onChange={(event) => setForm((prev) => ({ ...prev, backgroundColor: event.target.value }))} className="h-10 p-1" />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <BerkasGambar
                                label="Gambar Latar (desain 90 x 55 mm)"
                                url={form.backgroundImageUrl}
                                sedang={unggah === "latar"}
                                onPilih={(file) => unggahGambar("latar", file)}
                                onHapus={() => setForm((prev) => ({ ...prev, backgroundImageUrl: "" }))}
                            />
                            <BerkasGambar
                                label="Logo"
                                url={form.logoUrl}
                                sedang={unggah === "logo"}
                                onPilih={(file) => unggahGambar("logo", file)}
                                onHapus={() => setForm((prev) => ({ ...prev, logoUrl: "" }))}
                            />
                        </div>

                        {form.logoUrl && (
                            <div className="grid gap-3 sm:grid-cols-3">
                                <Angka label="Logo X (mm)" nilai={form.logoX} onChange={(v) => setForm((p) => ({ ...p, logoX: v }))} />
                                <Angka label="Logo Y (mm)" nilai={form.logoY} onChange={(v) => setForm((p) => ({ ...p, logoY: v }))} />
                                <Angka label="Lebar Logo (mm)" nilai={form.logoWidth} onChange={(v) => setForm((p) => ({ ...p, logoWidth: v }))} />
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="font-bold">Elemen Teks</h2>
                                <Button type="button" variant="outline" size="sm" onClick={tambahElemen}>
                                    <Type className="h-4 w-4" />
                                    Tambah Elemen
                                </Button>
                            </div>

                            {form.elements.length === 0 && (
                                <p className="text-sm text-muted-foreground">Belum ada elemen teks pada template ini.</p>
                            )}

                            {form.elements.map((element) => (
                                <div key={element.id} className="grid gap-2 rounded-lg border bg-gray-50 p-3 sm:grid-cols-2 lg:grid-cols-6">
                                    <div className="space-y-1 lg:col-span-2">
                                        <Label className="text-xs">Isi</Label>
                                        <select
                                            value={element.field}
                                            onChange={(event) => ubahElemen(element.id, { field: event.target.value as QrFieldKey })}
                                            className="h-9 w-full rounded-md border px-2 text-sm"
                                        >
                                            {QR_FIELDS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                                        </select>
                                        {element.field === "teks" && (
                                            <Input
                                                value={element.text || ""}
                                                onChange={(event) => ubahElemen(element.id, { text: event.target.value })}
                                                placeholder="Tulisan tetap"
                                                className="h-9"
                                            />
                                        )}
                                    </div>
                                    <Angka kecil label="X (mm)" nilai={element.x} onChange={(v) => ubahElemen(element.id, { x: v })} />
                                    <Angka kecil label="Y (mm)" nilai={element.y} onChange={(v) => ubahElemen(element.id, { y: v })} />
                                    <Angka kecil label="Ukuran (pt)" nilai={element.fontSize} onChange={(v) => ubahElemen(element.id, { fontSize: v })} />
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs">Warna</Label>
                                            <Input type="color" value={element.color} onChange={(event) => ubahElemen(element.id, { color: event.target.value })} className="h-9 p-1" />
                                        </div>
                                        <label className="flex h-9 items-center gap-1 text-xs">
                                            <input type="checkbox" className="h-3.5 w-3.5 accent-red-600" checked={element.bold} onChange={(event) => ubahElemen(element.id, { bold: event.target.checked })} />
                                            Tebal
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setForm((prev) => ({ ...prev, elements: prev.elements.filter((el) => el.id !== element.id) }))}
                                            className="mb-0.5 rounded-md border p-2"
                                            aria-label="Hapus elemen"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="space-y-3 p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold">Template Tersimpan</h2>
                            <Button type="button" variant="outline" size="sm" onClick={() => { setForm(FORM_BARU); setTerpilihId(null); }}>
                                <Plus className="h-4 w-4" />
                                Baru
                            </Button>
                        </div>

                        {templates.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                Belum ada template. Selama kosong, pencetakan memakai tata letak bawaan.
                            </p>
                        )}

                        {templates.map((row) => (
                            <div key={row.id} className={`rounded-lg border p-3 ${terpilihId === row.id ? "border-red-300 bg-red-50/40" : "bg-white"}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <button type="button" onClick={() => pilihTemplate(row)} className="min-w-0 text-left">
                                        <p className="truncate font-semibold text-gray-950">{row.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {row.isDefault ? "Dipakai saat mencetak" : "Tidak aktif"}
                                        </p>
                                    </button>
                                    <div className="flex shrink-0 gap-1">
                                        {row.isDefault && <Star className="mt-1 h-4 w-4 fill-amber-400 text-amber-500" />}
                                        <button type="button" onClick={() => { pilihTemplate(row); setForm((prev) => ({ ...prev, id: "", name: `${row.name} (salinan)`, isDefault: false })); }} className="rounded-md border p-1.5" aria-label="Duplikat template">
                                            <Copy className="h-3.5 w-3.5" />
                                        </button>
                                        <button type="button" onClick={() => hapus(row)} className="rounded-md border p-1.5" aria-label="Hapus template">
                                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Angka({ label, nilai, onChange, kecil = false }: { label: string; nilai: number; onChange: (nilai: number) => void; kecil?: boolean }) {
    return (
        <div className="space-y-1">
            <Label className={kecil ? "text-xs" : ""}>{label}</Label>
            <Input
                type="number"
                step="0.1"
                value={nilai}
                onChange={(event) => onChange(Number(event.target.value))}
                className={kecil ? "h-9" : ""}
            />
        </div>
    );
}

function BerkasGambar({ label, url, sedang, onPilih, onHapus }: {
    label: string;
    url: string;
    sedang: boolean;
    onPilih: (file: File) => void;
    onHapus: () => void;
}) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50">
                    {sedang ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    {sedang ? "Mengunggah..." : url ? "Ganti" : "Pilih Gambar"}
                    <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        disabled={sedang}
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) onPilih(file);
                            event.target.value = "";
                        }}
                    />
                </label>
                {url && (
                    <button type="button" onClick={onHapus} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                        <X className="h-3.5 w-3.5" />
                        Hapus
                    </button>
                )}
            </div>
            <p className="text-xs text-muted-foreground">PNG atau JPG. Format lain tidak bisa ditanam ke PDF.</p>
        </div>
    );
}
