"use client";

import { ExternalLink, X } from "lucide-react";

import { buildOutletMapsUrl } from "@/lib/mitra-outlet-options";
import { buildStreetViewEmbedUrl } from "@/lib/street-view";

/**
 * Titik apa pun yang punya koordinat: outlet maupun ODP. Panel ini sengaja tidak lagi
 * terikat bentuk data outlet -- yang dibutuhkannya hanya judul, keterangan, dan koordinat.
 */
export interface TitikStreetView {
    /** Dipakai sebagai key iframe; berganti berarti panorama dimuat ulang. */
    id: string;
    judul: string;
    keterangan: string;
    latitude: number;
    longitude: number;
}

export function StreetViewPanel({ titik, onClose }: { titik: TitikStreetView; onClose: () => void }) {
    return (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-4">
                <div className="min-w-0">
                    <h2 className="text-sm font-bold text-gray-950">Street View</h2>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {titik.judul} · {titik.keterangan}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 transition-colors hover:text-red-700"
                >
                    <X className="h-3.5 w-3.5" />
                    Tutup
                </button>
            </div>

            {/* key memaksa iframe dibuat ulang saat outlet berganti. Kalau hanya src-nya
                yang diganti, sebagian browser mencatatnya sebagai entri riwayat baru dan
                tombol "kembali" jadi menelusuri panorama satu per satu. */}
            <iframe
                key={titik.id}
                title={`Street View ${titik.judul}`}
                src={buildStreetViewEmbedUrl(titik.latitude, titik.longitude)}
                loading="lazy"
                allowFullScreen
                // Google mencocokkan pembatasan HTTP referrer pada API key dengan header
                // referrer permintaan ini; tanpa referrer, key yang dibatasi domain ditolak.
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[360px] w-full border-0 bg-gray-100 sm:h-[460px]"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
                <p className="text-xs text-muted-foreground">
                    Panorama dari titik jalan terdekat. Sebagian lokasi belum terjangkau mobil Street View.
                </p>
                <a
                    href={buildOutletMapsUrl(titik.latitude, titik.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                >
                    Buka di Google Maps
                    <ExternalLink className="h-3.5 w-3.5" />
                </a>
            </div>
        </div>
    );
}
