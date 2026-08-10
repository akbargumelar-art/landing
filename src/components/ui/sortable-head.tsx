"use client";

import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";

import type { UrutState } from "@/lib/use-sort";

/** Kepala kolom yang bisa diklik untuk mengurutkan; arah panah menunjukkan urutan aktif. */
export function TombolUrut({
    kolom,
    label,
    urut,
    onKlik,
    kanan = false,
}: {
    kolom: string;
    label: React.ReactNode;
    urut: UrutState;
    onKlik: (kolom: string) => void;
    kanan?: boolean;
}) {
    const aktif = urut.kolom === kolom;

    return (
        <button
            type="button"
            onClick={() => onKlik(kolom)}
            className={`inline-flex items-center gap-1 font-semibold transition-colors hover:text-red-600 ${aktif ? "text-red-600" : ""} ${kanan ? "flex-row-reverse" : ""}`}
            title={`Urutkan menurut ${typeof label === "string" ? label : kolom}`}
        >
            {label}
            {aktif
                ? (urut.naik ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />)
                : <ArrowDownAZ className="h-3.5 w-3.5 opacity-25" />}
        </button>
    );
}
