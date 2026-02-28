"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Plus, Trash2, Loader2, Save, ArrowUp, ArrowDown, GripVertical,
    Type, AlignLeft, Hash, Mail, Phone, ChevronDown, CircleDot, CheckSquare,
    CalendarIcon, Upload, ImageIcon, Minus, Columns2, Eye, Settings2, X,
} from "lucide-react";
import { formFields } from "@/db/schema";

// ---- Types ----
type ElementType =
    | "heading" | "paragraph" | "image" | "divider"
    | "name" | "phone" | "text" | "textarea" | "number" | "email"
    | "dropdown" | "radio" | "checkbox" | "date" | "file";

interface FormElement {
    id: string;
    type: ElementType;
    // Common
    label: string;
    placeholder: string;
    hintText: string;
    isRequired: boolean;
    // For static elements
    content: string; // heading text, paragraph text, image URL
    // For dropdown/radio/checkbox
    options: string[];
    // Layout
    colSpan: 1 | 2; // 1 = half width, 2 = full width
}

interface DynamicForm {
    id: string;
    programId: string;
    title: string;
    description: string;
    formSchema: string;
    isActive: boolean;
    program: { id: string; title: string };
    _count: { submissions: number };
}

interface Program {
    id: string;
    title: string;
}

const uid = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const newElement = (type: ElementType): FormElement => ({
    id: uid(),
    type,
    label: getDefaultLabel(type),
    placeholder: "",
    hintText: "",
    isRequired: false,
    content: "",
    options: type === "dropdown" || type === "radio" || type === "checkbox" ? ["Opsi 1", "Opsi 2"] : [],
    colSpan: type === "heading" || type === "paragraph" || type === "image" || type === "divider" || type === "textarea" || type === "file" ? 2 : 2,
});

function getDefaultLabel(type: ElementType): string {
    const labels: Record<ElementType, string> = {
        heading: "Judul Section", paragraph: "Teks deskripsi", image: "", divider: "",
        name: "Nama Lengkap", phone: "Nomor WhatsApp / HP", text: "Field Teks", textarea: "Field Teks Panjang",
        number: "Field Angka", email: "Email", dropdown: "Pilihan Dropdown",
        radio: "Pilihan Radio", checkbox: "Pilihan Checkbox", date: "Tanggal", file: "Upload File",
    };
    return labels[type];
}

const elementIcons: Record<ElementType, React.ReactNode> = {
    heading: <Type className="h-4 w-4" />,
    paragraph: <AlignLeft className="h-4 w-4" />,
    image: <ImageIcon className="h-4 w-4" />,
    divider: <Minus className="h-4 w-4" />,
    name: <Type className="h-4 w-4" />,
    phone: <Phone className="h-4 w-4" />,
    text: <Type className="h-4 w-4" />,
    textarea: <AlignLeft className="h-4 w-4" />,
    number: <Hash className="h-4 w-4" />,
    email: <Mail className="h-4 w-4" />,
    dropdown: <ChevronDown className="h-4 w-4" />,
    radio: <CircleDot className="h-4 w-4" />,
    checkbox: <CheckSquare className="h-4 w-4" />,
    date: <CalendarIcon className="h-4 w-4" />,
    file: <Upload className="h-4 w-4" />,
};

const elementCategories = [
    {
        title: "Layout & Teks",
        items: [
            { type: "heading" as ElementType, label: "Heading" },
            { type: "paragraph" as ElementType, label: "Paragraph" },
            { type: "image" as ElementType, label: "Image / Banner" },
            { type: "divider" as ElementType, label: "Divider" },
        ],
    },
    {
        title: "Input Fields",
        items: [
            { type: "name" as ElementType, label: "Nama Lengkap" },
            { type: "phone" as ElementType, label: "Nomor HP/WA" },
            { type: "text" as ElementType, label: "Short Text" },
            { type: "textarea" as ElementType, label: "Long Text" },
            { type: "number" as ElementType, label: "Number" },
            { type: "email" as ElementType, label: "Email" },
            { type: "dropdown" as ElementType, label: "Dropdown" },
            { type: "radio" as ElementType, label: "Radio" },
            { type: "checkbox" as ElementType, label: "Checkbox" },
            { type: "date" as ElementType, label: "Date Picker" },
            { type: "file" as ElementType, label: "File Upload" },
        ],
    },
];

const isStatic = (type: ElementType) => ["heading", "paragraph", "image", "divider"].includes(type);

// ---- Component ----
export default function FormBuilderPage() {
    const [forms, setForms] = useState<DynamicForm[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedForm, setSelectedForm] = useState<DynamicForm | null>(null);
    const [elements, setElements] = useState<FormElement[]>([]);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);
    const [message, setMessage] = useState("");
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Create form dialog
    const [createOpen, setCreateOpen] = useState(false);
    const [newFormTitle, setNewFormTitle] = useState("");
    const [newFormProgramId, setNewFormProgramId] = useState("");
    const [newFormDesc, setNewFormDesc] = useState("");

    useEffect(() => {
        Promise.all([
            fetch("/api/admin/forms").then((r) => r.json()),
            fetch("/api/admin/programs").then((r) => r.json()),
        ]).then(([formsData, programsData]) => {
            setForms(formsData);
            setPrograms(programsData);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const selectForm = useCallback(async (form: DynamicForm) => {
        setSelectedForm(form);
        setSelectedElementId(null);
        setPreviewMode(false);
        try {
            const res = await fetch(`/api/admin/forms/${form.id}`);
            const data = await res.json();
            if (data.fields && data.fields.length > 0) {
                // Map the DB fields back to the FormElement structure
                const updatedElements = data.fields.map((f: typeof formFields.$inferSelect) => ({
                    id: f.id,
                    type: f.fieldType,
                    label: f.label,
                    placeholder: f.placeholder,
                    hintText: f.hintText,
                    isRequired: f.isRequired,
                    content: f.placeholder,
                    options: typeof f.options === 'string' ? JSON.parse(f.options) : f.options,
                    colSpan: 1
                }));
                // We also need to restore colSpan from formSchema if possible
                try {
                    const schema = JSON.parse(form.formSchema || "[]");
                    updatedElements.forEach((el: Record<string, unknown>) => {
                        const match = schema.find((s: { id: string, colSpan: number }) => s.id === el.id);
                        if (match) el.colSpan = match.colSpan || 1;
                    });
                } catch { }

                setElements(updatedElements as FormElement[]);
            } else {
                const schema = JSON.parse(form.formSchema || "[]");
                setElements(schema.length > 0 ? schema : []);
            }
        } catch {
            const schema = JSON.parse(form.formSchema || "[]");
            setElements(schema.length > 0 ? schema : []);
        }
    }, []);

    const handleCreateForm = async () => {
        if (!newFormTitle || !newFormProgramId) return;
        setSaving(true);
        const res = await fetch("/api/admin/forms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newFormTitle, programId: newFormProgramId, description: newFormDesc }),
        });
        const created = await res.json();
        const formsRes = await fetch("/api/admin/forms");
        setForms(await formsRes.json());
        setCreateOpen(false);
        setNewFormTitle(""); setNewFormProgramId(""); setNewFormDesc("");
        setSaving(false);
        selectForm({ ...created, formSchema: "[]", program: programs.find((p) => p.id === newFormProgramId) || { id: "", title: "" }, _count: { submissions: 0 } });
    };

    const handleDeleteForm = async (id: string) => {
        if (!confirm("Hapus form ini beserta semua data?")) return;
        await fetch(`/api/admin/forms/${id}`, { method: "DELETE" });
        setForms((prev) => prev.filter((f) => f.id !== id));
        if (selectedForm?.id === id) { setSelectedForm(null); setElements([]); }
    };

    // Element operations
    const addElement = (type: ElementType) => {
        const el = newElement(type);
        setElements([...elements, el]);
        setSelectedElementId(el.id);
    };

    const removeElement = (id: string) => {
        setElements(elements.filter((e) => e.id !== id));
        if (selectedElementId === id) setSelectedElementId(null);
    };

    const updateElement = (id: string, updates: Partial<FormElement>) => {
        setElements(elements.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        setTimeout(() => {
            if (e.target instanceof HTMLElement) {
                e.target.style.opacity = "0.4";
            }
        }, 0);
    };

    const handleDragEnter = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDragEnd = (e: React.DragEvent) => {
        if (e.target instanceof HTMLElement) {
            e.target.style.opacity = "1";
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            handleDragEnd(e);
            return;
        }

        const newElements = [...elements];
        const draggedEl = newElements[draggedIndex];
        newElements.splice(draggedIndex, 1);
        newElements.splice(dropIndex, 0, draggedEl);

        setElements(newElements);
        handleDragEnd(e);
    };

    const saveForm = async () => {
        if (!selectedForm) return;
        setSaving(true);
        try {
            // 1. Update dynamicForms table (formSchema JSON)
            await fetch(`/api/admin/forms/${selectedForm.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...selectedForm, formSchema: JSON.stringify(elements) }),
            });

            // 2. Sync formFields table
            await fetch(`/api/admin/forms/${selectedForm.id}/fields`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fields: elements }),
            });

            setMessage("Form berhasil disimpan!");
        } catch (error) {
            console.error(error);
            setMessage("Gagal menyimpan form!");
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(""), 3000);
        }
    };

    const selectedElement = elements.find((e) => e.id === selectedElementId);

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="max-w-[1400px] space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Form Builder</h2>
                <Button onClick={() => setCreateOpen(true)} className="cursor-pointer"><Plus className="mr-1 h-4 w-4" /> Buat Form Baru</Button>
            </div>

            {message && <div className="p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{message}</div>}

            {/* Form Selector */}
            <div className="flex gap-3 items-center flex-wrap">
                <Label className="text-sm font-semibold shrink-0">Form:</Label>
                <select
                    value={selectedForm?.id || ""}
                    onChange={(e) => {
                        const f = forms.find((f) => f.id === e.target.value);
                        if (f) selectForm(f);
                    }}
                    className="px-3 py-2 border rounded-md text-sm bg-white min-w-[250px]"
                >
                    <option value="">Pilih form...</option>
                    {forms.map((f) => (
                        <option key={f.id} value={f.id}>{f.title} — {f.program?.title}</option>
                    ))}
                </select>
                {selectedForm && (
                    <>
                        <Badge variant={selectedForm.isActive ? "default" : "secondary"} className="text-xs">{selectedForm.isActive ? "Aktif" : "Nonaktif"}</Badge>
                        <span className="text-xs text-muted-foreground">{selectedForm._count?.submissions || 0} peserta</span>
                        <div className="flex-1" />
                        <Button variant="outline" size="sm" onClick={() => setPreviewMode(!previewMode)} className="cursor-pointer">
                            <Eye className="mr-1 h-4 w-4" /> {previewMode ? "Editor" : "Preview"}
                        </Button>
                        <Button size="sm" onClick={saveForm} disabled={saving} className="cursor-pointer">
                            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Simpan
                        </Button>
                        <button onClick={() => handleDeleteForm(selectedForm.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                    </>
                )}
            </div>

            {!selectedForm ? (
                <Card><CardContent className="py-16 text-center text-muted-foreground">
                    <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Pilih form dari dropdown di atas, atau buat form baru</p>
                </CardContent></Card>
            ) : previewMode ? (
                <PreviewPanel elements={elements} />
            ) : (
                <div className="grid grid-cols-12 gap-4">
                    {/* Left Panel: Element Palette */}
                    <div className="col-span-3 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Komponen</p>
                        {elementCategories.map((cat) => (
                            <div key={cat.title}>
                                <p className="text-xs font-bold text-muted-foreground mb-1.5">{cat.title}</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {cat.items.map((item) => (
                                        <button
                                            key={item.type}
                                            onClick={() => addElement(item.type)}
                                            className="flex flex-col items-center gap-1 p-2.5 rounded-lg border bg-white hover:bg-red-50 hover:border-red-200 transition-colors text-xs cursor-pointer"
                                        >
                                            {elementIcons[item.type]}
                                            <span className="text-[10px] font-medium">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Center: Canvas */}
                    <div className="col-span-5">
                        <Card className="min-h-[500px]">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm">Kanvas Form</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {elements.length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground text-sm">
                                        <Plus className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p>Klik komponen di kiri untuk menambahkan</p>
                                    </div>
                                )}
                                {elements.map((el, index) => (
                                    <div
                                        key={el.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={handleDragOver}
                                        onDragEnter={(e) => handleDragEnter(e, index)}
                                        onDragEnd={handleDragEnd}
                                        onDrop={(e) => handleDrop(e, index)}
                                        onClick={() => setSelectedElementId(el.id)}
                                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer group ${selectedElementId === el.id ? "border-red-500 bg-red-50/50" : "border-transparent bg-gray-50/80 hover:border-gray-300"} ${dragOverIndex === index ? (draggedIndex !== null && draggedIndex < index ? "border-b-red-500 border-b-4 pb-4 bg-gray-100" : "border-t-red-500 border-t-4 pt-4 bg-gray-100") : ""} ${draggedIndex === index ? "opacity-50 blur-sm scale-95" : ""}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-black/5 rounded group/grip">
                                                <GripVertical className="h-4 w-4 text-muted-foreground opacity-30 group-hover/grip:opacity-100 transition-opacity" />
                                            </div>
                                            {elementIcons[el.type]}
                                            <span className="text-xs font-medium text-muted-foreground flex-1 truncate">
                                                {isStatic(el.type) ? el.type.toUpperCase() : el.label}
                                            </span>
                                            {el.colSpan === 1 && <Columns2 className="h-3 w-3 text-muted-foreground" />}
                                            {!isStatic(el.type) && el.isRequired && <span className="text-red-500 text-xs">*</span>}
                                            <button onClick={(e) => { e.stopPropagation(); removeElement(el.id); }} className="p-1 rounded hover:bg-red-100 text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 className="h-3 w-3" /></button>
                                        </div>

                                        {/* Mini preview */}
                                        {el.type === "heading" && <p className="text-sm font-bold ml-8">{el.content || el.label}</p>}
                                        {el.type === "paragraph" && <p className="text-xs text-muted-foreground ml-8 line-clamp-2">{el.content || "Teks paragraf..."}</p>}
                                        {el.type === "divider" && <hr className="ml-8 border-gray-300" />}
                                        {el.type === "image" && (
                                            el.content ? <img src={el.content} alt="" className="ml-8 h-12 rounded object-cover" /> : <div className="ml-8 h-10 bg-gray-200 rounded flex items-center justify-center text-xs text-muted-foreground">Belum ada gambar</div>
                                        )}
                                        {!isStatic(el.type) && (
                                            <div className="ml-8 mt-1">
                                                <div className="h-8 bg-white border rounded px-2 flex items-center text-xs text-muted-foreground">{el.placeholder || el.label}</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Properties Panel */}
                    <div className="col-span-4">
                        {selectedElement ? (
                            <PropertiesPanel element={selectedElement} onChange={(updates) => updateElement(selectedElement.id, updates)} onClose={() => setSelectedElementId(null)} />
                        ) : (
                            <Card className="min-h-[500px]">
                                <CardContent className="py-16 text-center text-muted-foreground">
                                    <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Klik elemen di kanvas untuk mengedit</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {/* Create Form Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Buat Form Baru</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Judul Form</Label>
                            <Input value={newFormTitle} onChange={(e) => setNewFormTitle(e.target.value)} placeholder="Formulir Pendaftaran Undian" />
                        </div>
                        <div className="space-y-2">
                            <Label>Program</Label>
                            <select value={newFormProgramId} onChange={(e) => setNewFormProgramId(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm bg-white">
                                <option value="">Pilih program...</option>
                                {programs.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Deskripsi (opsional)</Label>
                            <Textarea value={newFormDesc} onChange={(e) => setNewFormDesc(e.target.value)} rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)} className="cursor-pointer">Batal</Button>
                        <Button onClick={handleCreateForm} disabled={saving || !newFormTitle || !newFormProgramId} className="cursor-pointer">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Buat Form
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ---- Properties Panel ----
function PropertiesPanel({ element, onChange, onClose }: {
    element: FormElement;
    onChange: (updates: Partial<FormElement>) => void;
    onClose: () => void;
}) {
    const static_ = isStatic(element.type);
    const hasOptions = ["dropdown", "radio", "checkbox"].includes(element.type);
    const [isUploading, setIsUploading] = useState(false);

    return (
        <Card className="min-h-[500px]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm flex items-center gap-2">{elementIcons[element.type]} Pengaturan</CardTitle>
                <button onClick={onClose} className="p-1 rounded hover:bg-muted cursor-pointer"><X className="h-4 w-4" /></button>
            </CardHeader>
            <CardContent className="space-y-4">
                <Badge variant="outline" className="text-xs">{element.type.toUpperCase()}</Badge>

                {/* Static: Heading / Paragraph */}
                {(element.type === "heading" || element.type === "paragraph") && (
                    <div className="space-y-2">
                        <Label className="text-xs">Konten Teks</Label>
                        {element.type === "heading" ? (
                            <Input value={element.content} onChange={(e) => onChange({ content: e.target.value })} placeholder="Judul section..." />
                        ) : (
                            <Textarea value={element.content} onChange={(e) => onChange({ content: e.target.value })} rows={3} placeholder="Teks deskripsi..." />
                        )}
                    </div>
                )}

                {/* Static: Image */}
                {element.type === "image" && (
                    <div className="space-y-2">
                        <Label className="text-xs">URL Gambar / Upload</Label>
                        <div className="flex gap-2">
                            <Input value={element.content} onChange={(e) => onChange({ content: e.target.value })} placeholder="https://..." className="flex-1" />
                            <button type="button" disabled={isUploading} className="px-3 py-2 border rounded-md cursor-pointer hover:bg-muted text-sm flex items-center gap-1 disabled:opacity-50" onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*";
                                input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (!file) return;
                                    setIsUploading(true);
                                    try {
                                        const fd = new FormData();
                                        fd.append("file", file);
                                        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                                        const data = await res.json();
                                        if (res.ok && data.url) {
                                            onChange({ content: data.url });
                                        } else {
                                            alert(data.error || "Gagal upload gambar");
                                        }
                                    } catch (err) {
                                        alert("Gagal koneksi server saat upload file.");
                                    } finally {
                                        setIsUploading(false);
                                    }
                                };
                                input.click();
                            }}>
                                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            </button>
                        </div>
                        {element.content && <img src={element.content} alt="" className="w-full h-24 object-cover rounded border" />}
                    </div>
                )}

                {/* Input Fields */}
                {!static_ && (
                    <>
                        <div className="space-y-2">
                            <Label className="text-xs">Label Field (Pertanyaan)</Label>
                            <Input value={element.label} onChange={(e) => onChange({ label: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Placeholder</Label>
                            <Input value={element.placeholder} onChange={(e) => onChange({ placeholder: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Helper Text / Hint</Label>
                            <Input value={element.hintText} onChange={(e) => onChange({ hintText: e.target.value })} />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={element.isRequired} onChange={(e) => onChange({ isRequired: e.target.checked })} className="rounded" />
                            <span className="text-sm">Wajib diisi (Required)</span>
                        </label>
                    </>
                )}

                {/* Options */}
                {hasOptions && (
                    <div className="space-y-2">
                        <Label className="text-xs">Opsi Pilihan</Label>
                        {element.options.map((opt, i) => (
                            <div key={i} className="flex gap-2">
                                <Input value={opt} onChange={(e) => {
                                    const newOpts = [...element.options];
                                    newOpts[i] = e.target.value;
                                    onChange({ options: newOpts });
                                }} className="flex-1 text-sm" />
                                <button onClick={() => onChange({ options: element.options.filter((_, j) => j !== i) })} className="p-1 text-red-400 hover:text-red-600 cursor-pointer"><Trash2 className="h-3 w-3" /></button>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => onChange({ options: [...element.options, `Opsi ${element.options.length + 1}`] })} className="w-full cursor-pointer text-xs">
                            <Plus className="mr-1 h-3 w-3" /> Tambah Opsi
                        </Button>
                        <label className="flex items-center justify-center gap-1 w-full px-3 py-1.5 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-xs text-muted-foreground">
                            <Upload className="h-3 w-3" /> Upload List (.txt / .csv)
                            <input type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    const text = ev.target?.result as string;
                                    if (!text) return;
                                    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                                    if (lines.length > 0) {
                                        onChange({ options: [...element.options, ...lines] });
                                    }
                                };
                                reader.readAsText(file);
                                e.target.value = "";
                            }} />
                        </label>
                        <p className="text-[10px] text-muted-foreground">{element.options.length} opsi. Upload file teks (satu opsi per baris) untuk import massal.</p>
                    </div>
                )}

                {/* Layout */}
                <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs">Lebar Kolom</Label>
                    <div className="flex gap-2">
                        <button onClick={() => onChange({ colSpan: 2 })} className={`flex-1 p-2 rounded border text-xs cursor-pointer ${element.colSpan === 2 ? "bg-red-50 border-red-300 font-semibold" : ""}`}>Full width</button>
                        <button onClick={() => onChange({ colSpan: 1 })} className={`flex-1 p-2 rounded border text-xs cursor-pointer ${element.colSpan === 1 ? "bg-red-50 border-red-300 font-semibold" : ""}`}>Half width</button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ---- Preview Panel ----
function PreviewPanel({ elements }: { elements: FormElement[] }) {
    return (
        <div className="max-w-xl mx-auto">
            <Card className="border-0 shadow-2xl">
                <CardContent className="p-8">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                        {elements.map((el) => (
                            <div key={el.id} className={el.colSpan === 2 ? "col-span-2" : "col-span-1"}>
                                {el.type === "heading" && <h3 className="text-lg font-bold text-foreground">{el.content || el.label}</h3>}
                                {el.type === "paragraph" && <p className="text-sm text-muted-foreground">{el.content}</p>}
                                {el.type === "divider" && <hr className="border-gray-200 my-2" />}
                                {el.type === "image" && el.content && <img src={el.content} alt="" className="w-full rounded-lg" />}

                                {el.type === "text" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <input type="text" placeholder={el.placeholder} className="w-full px-3 py-2 border rounded-lg text-sm" />
                                        {el.hintText && <p className="text-xs text-muted-foreground">{el.hintText}</p>}
                                    </div>
                                )}
                                {el.type === "name" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <input type="text" placeholder={el.placeholder || "Masukkan nama lengkap"} className="w-full px-3 py-2 border rounded-lg text-sm" />
                                        {el.hintText && <p className="text-xs text-muted-foreground">{el.hintText}</p>}
                                    </div>
                                )}
                                {el.type === "phone" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <input type="tel" placeholder={el.placeholder || "08xxxxxxxxxx"} className="w-full px-3 py-2 border rounded-lg text-sm" />
                                        {el.hintText && <p className="text-xs text-muted-foreground">{el.hintText}</p>}
                                    </div>
                                )}
                                {el.type === "textarea" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <textarea placeholder={el.placeholder} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
                                        {el.hintText && <p className="text-xs text-muted-foreground">{el.hintText}</p>}
                                    </div>
                                )}
                                {el.type === "number" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <input type="number" placeholder={el.placeholder} className="w-full px-3 py-2 border rounded-lg text-sm" />
                                    </div>
                                )}
                                {el.type === "email" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <input type="email" placeholder={el.placeholder || "email@contoh.com"} className="w-full px-3 py-2 border rounded-lg text-sm" />
                                    </div>
                                )}
                                {el.type === "dropdown" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <div className="flex items-center w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-muted-foreground bg-white">
                                            <span>{el.placeholder || "Ketik untuk mencari..."}</span>
                                            <svg className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">{el.options.length} opsi — searchable dropdown</p>
                                    </div>
                                )}
                                {el.type === "radio" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <div className="space-y-1">
                                            {el.options.map((opt, i) => (
                                                <label key={i} className="flex items-center gap-2 text-sm"><input type="radio" name={el.id} /> {opt}</label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {el.type === "checkbox" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <div className="space-y-1">
                                            {el.options.map((opt, i) => (
                                                <label key={i} className="flex items-center gap-2 text-sm"><input type="checkbox" /> {opt}</label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {el.type === "date" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <input type="date" className="w-full px-3 py-2 border rounded-lg text-sm" />
                                    </div>
                                )}
                                {el.type === "file" && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                        <div className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
                                            <Upload className="h-6 w-6 mx-auto mb-1 opacity-50" />
                                            <p>Drag & drop atau pilih file</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {elements.length > 0 && (
                        <Button className="w-full mt-6 cursor-pointer" size="lg" disabled>Kirim Pendaftaran</Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
