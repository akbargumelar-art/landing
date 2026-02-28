"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle, Loader2, X, ArrowLeft } from "lucide-react";

// ---- Types ----
interface FormElement {
    id: string;
    type: string;
    label: string;
    placeholder: string;
    hintText: string;
    isRequired: boolean;
    content: string;
    options: string[];
    colSpan: 1 | 2;
}

interface FormData {
    id: string;
    title: string;
    description: string;
    formSchema: string;
    program?: { id: string; title: string; slug: string } | null;
}

// ---- Defaults (fallback when no formId provided) ----
const DEFAULT_FORM_ELEMENTS: FormElement[] = [
    { id: "nama", type: "text", label: "Nama Lengkap", placeholder: "Masukkan nama lengkap", hintText: "", isRequired: true, content: "", options: [], colSpan: 2 },
    { id: "nomor", type: "phone", label: "Nomor Telkomsel", placeholder: "08xxxxxxxxxx", hintText: "", isRequired: true, content: "", options: [], colSpan: 2 },
    { id: "outlet", type: "text", label: "Nama Mitra Outlet", placeholder: "Masukkan nama outlet", hintText: "", isRequired: true, content: "", options: [], colSpan: 2 },
    { id: "bukti", type: "file", label: "Bukti Pembelian", placeholder: "", hintText: "", isRequired: true, content: "", options: [], colSpan: 2 },
];

export default function FormUndianPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <FormUndianContent />
        </Suspense>
    );
}

// ---- Searchable Dropdown Component ----
function SearchableDropdown({ options, value, onChange, placeholder, hasError }: {
    options: string[];
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    hasError?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);

    const filtered = search
        ? options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()))
        : options;

    // Close on click outside
    React.useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // Scroll highlighted item into view
    React.useEffect(() => {
        if (highlightIndex >= 0 && listRef.current) {
            const items = listRef.current.querySelectorAll("[data-option]");
            items[highlightIndex]?.scrollIntoView({ block: "nearest" });
        }
    }, [highlightIndex]);

    const selectOption = (opt: string) => {
        onChange(opt);
        setIsOpen(false);
        setSearch("");
        setHighlightIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlightIndex >= 0 && highlightIndex < filtered.length) {
                selectOption(filtered[highlightIndex]);
            }
        } else if (e.key === "Escape") {
            setIsOpen(false);
            setSearch("");
        }
    };

    return (
        <div ref={wrapperRef} className="relative">
            <div
                className={`flex items-center w-full px-3 py-2 border rounded-lg text-sm cursor-pointer transition-colors ${hasError ? "border-red-500" : isOpen ? "border-primary ring-2 ring-primary/30" : "border-gray-200"}`}
                onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
            >
                {isOpen ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setHighlightIndex(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder={value || placeholder}
                        className="w-full outline-none bg-transparent text-sm"
                        autoFocus
                    />
                ) : (
                    <span className={value ? "text-foreground" : "text-muted-foreground"}>
                        {value || placeholder}
                    </span>
                )}
                <svg className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </div>
            {isOpen && (
                <div ref={listRef} className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {value && (
                        <button
                            type="button"
                            onClick={() => selectOption("")}
                            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-gray-50 border-b cursor-pointer"
                        >
                            ✕ Hapus pilihan
                        </button>
                    )}
                    {filtered.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-muted-foreground text-center">Tidak ditemukan</div>
                    ) : (
                        filtered.map((opt, i) => (
                            <button
                                type="button"
                                key={i}
                                data-option
                                onClick={() => selectOption(opt)}
                                className={`w-full px-3 py-2 text-left text-sm cursor-pointer transition-colors ${opt === value ? "bg-primary/10 text-primary font-medium" : highlightIndex === i ? "bg-gray-100" : "hover:bg-gray-50"}`}
                            >
                                {opt}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function FormUndianContent() {
    const searchParams = useSearchParams();
    const formId = searchParams.get("id");

    const [formInfo, setFormInfo] = useState<FormData | null>(null);
    const [elements, setElements] = useState<FormElement[]>([]);
    const [values, setValues] = useState<Record<string, string>>({});
    const [files, setFiles] = useState<Record<string, File | null>>({});
    const [dragActiveId, setDragActiveId] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [settings, setSettings] = useState<Record<string, string>>({});

    // Fetch site settings (logo, name)
    useEffect(() => {
        fetch("/api/public/settings")
            .then((r) => r.json())
            .then((data) => setSettings(data))
            .catch(() => { });
    }, []);

    // Fetch form schema
    useEffect(() => {
        if (formId) {
            fetch(`/api/forms/${formId}`)
                .then((r) => {
                    if (!r.ok) throw new Error("Not found");
                    return r.json();
                })
                .then((data: FormData) => {
                    setFormInfo(data);
                    try {
                        const schema = JSON.parse(data.formSchema || "[]");
                        setElements(schema.length > 0 ? schema : DEFAULT_FORM_ELEMENTS);
                    } catch {
                        setElements(DEFAULT_FORM_ELEMENTS);
                    }
                    setIsLoading(false);
                })
                .catch(() => {
                    setElements(DEFAULT_FORM_ELEMENTS);
                    setIsLoading(false);
                });
        } else {
            setElements(DEFAULT_FORM_ELEMENTS);
            setIsLoading(false);
        }
    }, [formId]);

    const setValue = (id: string, value: string) => {
        setValues((prev) => ({ ...prev, [id]: value }));
    };

    const setFile = (id: string, file: File | null) => {
        setFiles((prev) => ({ ...prev, [id]: file }));
    };

    const handleDrag = useCallback((e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActiveId(id);
        } else if (e.type === "dragleave") {
            setDragActiveId(null);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActiveId(null);
        if (e.dataTransfer.files?.[0]) {
            setFile(id, e.dataTransfer.files[0]);
        }
    }, []);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        for (const el of elements) {
            if (el.type === "heading" || el.type === "paragraph" || el.type === "image" || el.type === "divider") continue;
            if (el.isRequired) {
                if (el.type === "file") {
                    if (!files[el.id]) newErrors[el.id] = `${el.label} wajib diupload`;
                } else {
                    if (!values[el.id]?.trim()) newErrors[el.id] = `${el.label} wajib diisi`;
                }
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        setSubmitError("");

        if (formId) {
            // Dynamic form submit
            const fd = new FormData();
            for (const el of elements) {
                if (el.type === "heading" || el.type === "paragraph" || el.type === "image" || el.type === "divider") continue;
                if (el.type === "file") {
                    if (files[el.id]) fd.append(`field_${el.id}`, files[el.id]!);
                } else {
                    fd.append(`field_${el.id}`, values[el.id] || "");
                }
            }
            try {
                const res = await fetch(`/api/forms/${formId}/submit`, { method: "POST", body: fd });
                const data = await res.json();
                if (res.ok) {
                    setIsSuccess(true);
                } else {
                    setSubmitError(data.error || "Gagal mengirim data");
                }
            } catch {
                setSubmitError("Terjadi kesalahan jaringan");
            }
        } else {
            // Legacy/fallback — just simulate
            await new Promise((r) => setTimeout(r, 2000));
            setIsSuccess(true);
        }

        setIsSubmitting(false);
    };

    const siteName = settings.site_name || "ABK Ciraya";
    const logoUrl = settings.logo_url || "";

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-0 shadow-2xl">
                    <CardContent className="p-8 text-center">
                        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 animate-bounce">
                            <CheckCircle className="h-10 w-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            Terima Kasih! 🎉
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            Data Anda telah berhasil dikirim. Kami akan memproses pendaftaran
                            undian Anda. Semoga beruntung!
                        </p>
                        <Button
                            onClick={() => {
                                setIsSuccess(false);
                                setValues({});
                                setFiles({});
                                setErrors({});
                            }}
                            variant="outline"
                            className="w-full cursor-pointer"
                        >
                            Daftar Lagi
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-lg relative">
                {formInfo?.program?.slug && (
                    <div className="absolute -top-12 left-0">
                        <Link href={`/program/${formInfo.program.slug}`}>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground cursor-pointer -ml-2">
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Kembali ke {formInfo?.program?.title || "Program"}
                            </Button>
                        </Link>
                    </div>
                )}

                {/* Logo */}
                <div className="text-center mb-8">
                    {logoUrl ? (
                        <img src={logoUrl} alt={siteName} className="h-12 w-auto mx-auto mb-3 rounded-lg" />
                    ) : (
                        <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                            <span className="text-white font-bold text-xl">A</span>
                        </div>
                    )}
                    <h1 className="text-xl font-bold text-foreground">{siteName}</h1>
                    <p className="text-sm text-muted-foreground">
                        {formInfo?.title || "Formulir Pendaftaran Undian"}
                    </p>
                </div>

                <Card className="border-0 shadow-2xl">
                    {formInfo?.description && (
                        <CardHeader>
                            <CardTitle className="text-lg">{formInfo.description}</CardTitle>
                        </CardHeader>
                    )}
                    <CardContent className={formInfo?.description ? "" : "pt-6"}>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                                {elements.map((el) => (
                                    <div key={el.id} className={el.colSpan === 2 ? "col-span-2" : "col-span-1"}>
                                        {/* Static elements */}
                                        {el.type === "heading" && <h3 className="text-lg font-bold text-foreground">{el.content || el.label}</h3>}
                                        {el.type === "paragraph" && <p className="text-sm text-muted-foreground">{el.content}</p>}
                                        {el.type === "divider" && <hr className="border-gray-200 my-2" />}
                                        {el.type === "image" && el.content && <img src={el.content} alt="" className="w-full rounded-lg" />}

                                        {/* Text */}
                                        {el.type === "text" && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                                <input
                                                    type="text"
                                                    placeholder={el.placeholder}
                                                    value={values[el.id] || ""}
                                                    onChange={(e) => setValue(el.id, e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors[el.id] ? "border-red-500" : "border-gray-200"}`}
                                                />
                                                {el.hintText && <p className="text-xs text-muted-foreground">{el.hintText}</p>}
                                                {errors[el.id] && <p className="text-xs text-red-500">{errors[el.id]}</p>}
                                            </div>
                                        )}

                                        {/* Textarea */}
                                        {el.type === "textarea" && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                                <textarea
                                                    placeholder={el.placeholder}
                                                    value={values[el.id] || ""}
                                                    onChange={(e) => setValue(el.id, e.target.value)}
                                                    rows={3}
                                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors[el.id] ? "border-red-500" : "border-gray-200"}`}
                                                />
                                                {el.hintText && <p className="text-xs text-muted-foreground">{el.hintText}</p>}
                                                {errors[el.id] && <p className="text-xs text-red-500">{errors[el.id]}</p>}
                                            </div>
                                        )}

                                        {/* Number */}
                                        {el.type === "number" && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                                <input
                                                    type="number"
                                                    placeholder={el.placeholder}
                                                    value={values[el.id] || ""}
                                                    onChange={(e) => setValue(el.id, e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors[el.id] ? "border-red-500" : "border-gray-200"}`}
                                                />
                                                {errors[el.id] && <p className="text-xs text-red-500">{errors[el.id]}</p>}
                                            </div>
                                        )}

                                        {/* Email */}
                                        {el.type === "email" && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                                <input
                                                    type="email"
                                                    placeholder={el.placeholder || "email@contoh.com"}
                                                    value={values[el.id] || ""}
                                                    onChange={(e) => setValue(el.id, e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors[el.id] ? "border-red-500" : "border-gray-200"}`}
                                                />
                                                {errors[el.id] && <p className="text-xs text-red-500">{errors[el.id]}</p>}
                                            </div>
                                        )}

                                        {/* Phone */}
                                        {el.type === "phone" && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                                <input
                                                    type="tel"
                                                    placeholder={el.placeholder || "08xxxxxxxxxx"}
                                                    value={values[el.id] || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, "");
                                                        setValue(el.id, val);
                                                    }}
                                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors[el.id] ? "border-red-500" : "border-gray-200"}`}
                                                />
                                                {errors[el.id] && <p className="text-xs text-red-500">{errors[el.id]}</p>}
                                            </div>
                                        )}

                                        {/* Dropdown (Searchable) */}
                                        {el.type === "dropdown" && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                                <SearchableDropdown
                                                    options={el.options}
                                                    value={values[el.id] || ""}
                                                    onChange={(val) => setValue(el.id, val)}
                                                    placeholder={el.placeholder || "Pilih..."}
                                                    hasError={!!errors[el.id]}
                                                />
                                                {el.hintText && <p className="text-xs text-muted-foreground">{el.hintText}</p>}
                                                {errors[el.id] && <p className="text-xs text-red-500">{errors[el.id]}</p>}
                                            </div>
                                        )}

                                        {/* Radio */}
                                        {el.type === "radio" && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                                <div className="space-y-1.5">
                                                    {el.options.map((opt, i) => (
                                                        <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name={`radio_${el.id}`}
                                                                value={opt}
                                                                checked={values[el.id] === opt}
                                                                onChange={(e) => setValue(el.id, e.target.value)}
                                                            />
                                                            {opt}
                                                        </label>
                                                    ))}
                                                </div>
                                                {errors[el.id] && <p className="text-xs text-red-500">{errors[el.id]}</p>}
                                            </div>
                                        )}

                                        {/* Checkbox */}
                                        {el.type === "checkbox" && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                                <div className="space-y-1.5">
                                                    {el.options.map((opt, i) => (
                                                        <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                value={opt}
                                                                checked={(values[el.id] || "").split("||").includes(opt)}
                                                                onChange={(e) => {
                                                                    const current = (values[el.id] || "").split("||").filter(Boolean);
                                                                    if (e.target.checked) {
                                                                        current.push(opt);
                                                                    } else {
                                                                        const idx = current.indexOf(opt);
                                                                        if (idx >= 0) current.splice(idx, 1);
                                                                    }
                                                                    setValue(el.id, current.join("||"));
                                                                }}
                                                            />
                                                            {opt}
                                                        </label>
                                                    ))}
                                                </div>
                                                {errors[el.id] && <p className="text-xs text-red-500">{errors[el.id]}</p>}
                                            </div>
                                        )}

                                        {/* Date */}
                                        {el.type === "date" && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                                <input
                                                    type="date"
                                                    value={values[el.id] || ""}
                                                    onChange={(e) => setValue(el.id, e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors[el.id] ? "border-red-500" : "border-gray-200"}`}
                                                />
                                                {errors[el.id] && <p className="text-xs text-red-500">{errors[el.id]}</p>}
                                            </div>
                                        )}

                                        {/* File Upload */}
                                        {el.type === "file" && (
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">{el.label} {el.isRequired && <span className="text-red-500">*</span>}</label>
                                                <div
                                                    onDragEnter={(e) => handleDrag(e, el.id)}
                                                    onDragLeave={(e) => handleDrag(e, el.id)}
                                                    onDragOver={(e) => handleDrag(e, el.id)}
                                                    onDrop={(e) => handleDrop(e, el.id)}
                                                    className={`relative rounded-lg border-2 border-dashed p-4 text-center transition-all duration-200 ${dragActiveId === el.id
                                                        ? "border-primary bg-primary/5"
                                                        : errors[el.id]
                                                            ? "border-red-300 bg-red-50"
                                                            : "border-gray-200 hover:border-primary/50"
                                                        }`}
                                                >
                                                    {files[el.id] ? (
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                                                <span className="text-sm text-foreground truncate max-w-[200px]">
                                                                    {files[el.id]!.name}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setFile(el.id, null)}
                                                                className="text-muted-foreground hover:text-foreground cursor-pointer"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                                                            <p className="text-sm text-muted-foreground">
                                                                Drag & drop atau{" "}
                                                                <label className="text-primary cursor-pointer hover:underline">
                                                                    pilih file
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*,.pdf,.doc,.docx"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            if (e.target.files?.[0]) setFile(el.id, e.target.files[0]);
                                                                        }}
                                                                    />
                                                                </label>
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                                {el.hintText && <p className="text-xs text-muted-foreground">{el.hintText}</p>}
                                                {errors[el.id] && <p className="text-xs text-red-500">{errors[el.id]}</p>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {submitError && (
                                <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                                    {submitError}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full cursor-pointer"
                                size="lg"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Mengirim...
                                    </>
                                ) : (
                                    "Kirim Pendaftaran"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
