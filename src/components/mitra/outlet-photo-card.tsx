"use client";

import Image from "next/image";
import React from "react";
import { Camera, ImageIcon, Images, Loader2, TriangleAlert } from "lucide-react";

import {
    BATAS_SEGAR_HARI,
    MITRA_PHOTO_SLOTS,
    formatTanggalFoto,
    statusFoto,
    type MitraPhotoSlotKey,
} from "@/lib/mitra-outlet-photos";

/**
 * Sengaja longgar: dua halaman pemanggilnya memiliki bentuk data berbeda (profil publik
 * dan detail terverifikasi), dan kartu ini hanya membaca kolom foto yang namanya sudah
 * ditetapkan MITRA_PHOTO_SLOTS. Nilainya dinormalkan saat dibaca.
 */
type SumberFoto = Record<string, unknown>;

function bacaTeks(nilai: unknown): string | null {
    return typeof nilai === "string" && nilai.length > 0 ? nilai : null;
}

/**
 * Satu tombol pilih berkas. Dipakai dua kali per slot dengan satu-satunya perbedaan pada
 * atribut `capture`, supaya aturan berkas yang diterima -- tipe dan penanganan pilihan --
 * tidak punya dua salinan yang bisa menyimpang diam-diam.
 */
function TombolPilihFoto({
    label,
    icon: Icon,
    langsungKamera,
    nonaktif,
    onPilih,
}: {
    label: string;
    icon: typeof Camera;
    langsungKamera?: boolean;
    nonaktif: boolean;
    onPilih: (file: File) => void;
}) {
    return (
        <label
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold ${
                nonaktif ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gray-50"
            }`}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
            <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                // Hanya tombol kamera yang memakai `capture`. Di tombol galeri atribut ini
                // harus BENAR-BENAR tidak ada, bukan diisi string kosong -- sebagian ponsel
                // memperlakukan `capture=""` sebagai perintah membuka kamera juga.
                {...(langsungKamera ? { capture: "environment" as const } : {})}
                className="hidden"
                disabled={nonaktif}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onPilih(file);
                    event.target.value = "";
                }}
            />
        </label>
    );
}

/**
 * Kartu empat foto outlet, dipakai dua halaman dengan satu perbedaan: di profil publik
 * hanya ditampilkan, di halaman detail bisa diunggah ulang. Perbedaan itu diatur lewat
 * ada-tidaknya `onUpload`, bukan lewat dua komponen yang mudah berbeda diam-diam.
 */
export function OutletPhotoCard({
    outlet,
    onUpload,
    sedangUnggah,
}: {
    outlet: SumberFoto;
    onUpload?: (slot: MitraPhotoSlotKey, file: File) => void;
    sedangUnggah?: MitraPhotoSlotKey | null;
}) {
    const bisaUnggah = Boolean(onUpload);
    const jumlahPerluDiperbarui = MITRA_PHOTO_SLOTS.filter(
        (slot) => statusFoto(bacaTeks(outlet[slot.atColumn])).perluDiperbarui
    ).length;

    return (
        <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h2 className="font-bold">Foto Outlet</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Diperbarui salesforce setiap kunjungan, dijadwalkan {BATAS_SEGAR_HARI} hari sekali.
                    </p>
                </div>
                {jumlahPerluDiperbarui > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        {jumlahPerluDiperbarui} foto perlu diperbarui
                    </span>
                )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {MITRA_PHOTO_SLOTS.map((slot) => {
                    const url = bacaTeks(outlet[slot.urlColumn]);
                    const status = statusFoto(bacaTeks(outlet[slot.atColumn]));
                    const unggahSlotIni = sedangUnggah === slot.key;

                    return (
                        <div key={slot.key} className="overflow-hidden rounded-lg border">
                            <div className="relative h-36 w-full bg-gray-100">
                                {url ? (
                                    <Image src={url} alt={slot.label} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" unoptimized />
                                ) : (
                                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                                        <ImageIcon className="h-7 w-7" />
                                        <span className="text-xs">Belum ada foto</span>
                                    </div>
                                )}
                                {slot.utama && (
                                    <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                        Foto utama
                                    </span>
                                )}
                            </div>

                            <div className="space-y-1 p-3">
                                <p className="text-sm font-semibold text-gray-950">{slot.label}</p>
                                <p className="text-xs text-muted-foreground">{slot.hint}</p>
                                <p className={`text-xs font-semibold ${status.perluDiperbarui ? "text-amber-700" : "text-green-700"}`}>
                                    {status.label}
                                </p>
                                {url && <p className="text-xs text-muted-foreground">{formatTanggalFoto(bacaTeks(outlet[slot.atColumn]))}</p>}

                                {bisaUnggah && (unggahSlotIni ? (
                                    <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Mengunggah...
                                    </div>
                                ) : (
                                    /* Dua jalan masuk yang setara. Tombol Kamera didahulukan karena
                                       memotret di tempat adalah cara yang diharapkan; Galeri untuk
                                       foto yang sudah diambil lebih dulu, mis. saat sinyal di outlet
                                       mati dan unggahannya baru bisa dilakukan setelah pindah tempat. */
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <TombolPilihFoto
                                            label="Kamera"
                                            icon={Camera}
                                            langsungKamera
                                            nonaktif={Boolean(sedangUnggah)}
                                            onPilih={(file) => onUpload?.(slot.key, file)}
                                        />
                                        <TombolPilihFoto
                                            label="Galeri"
                                            icon={Images}
                                            nonaktif={Boolean(sedangUnggah)}
                                            onPilih={(file) => onUpload?.(slot.key, file)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {bisaUnggah && (
                <p className="mt-3 text-xs text-muted-foreground">Format JPG, PNG, atau WebP. Maksimal 5 MB per foto.</p>
            )}
        </div>
    );
}
