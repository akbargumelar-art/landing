"use client";

import React from "react";

export interface UrutState<K extends string = string> {
    kolom: K | "";
    naik: boolean;
}

/**
 * State urutan tabel generik: klik kolom yang sama membalik arah, klik kolom lain
 * pindah ke kolom itu menaik. Dipakai bersama oleh semua tabel yang punya sort.
 */
export function useUrutTabel<K extends string>(kolomAwal: K | "" = "") {
    const [urut, setUrut] = React.useState<UrutState<K>>({ kolom: kolomAwal, naik: true });
    const gantiUrut = React.useCallback((kolom: K) => {
        setUrut((sebelumnya) => (sebelumnya.kolom === kolom ? { kolom, naik: !sebelumnya.naik } : { kolom, naik: true }));
    }, []);
    return { urut, gantiUrut, setUrut } as const;
}

/**
 * Bandingkan dua nilai apa adanya: angka dibandingkan numerik, teks yang keduanya
 * berupa angka (mis. "12") ikut dibandingkan numerik, sisanya localeCompare dengan
 * mode numeric supaya "Kecamatan 2" berada sebelum "Kecamatan 10".
 */
export function bandingkanNilai(a: unknown, b: unknown): number {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();

    const kiri = String(a ?? "");
    const kanan = String(b ?? "");
    if (kiri !== "" && kanan !== "" && !Number.isNaN(Number(kiri)) && !Number.isNaN(Number(kanan))) {
        return Number(kiri) - Number(kanan);
    }
    return kiri.localeCompare(kanan, "id-ID", { numeric: true, sensitivity: "base" });
}

/** Urutkan salinan array berdasarkan field yang diambil accessor, mengikuti arah `urut`. */
export function urutkanBaris<T>(baris: T[], urut: UrutState, accessor: (item: T, kolom: string) => unknown): T[] {
    if (!urut.kolom) return baris;
    return [...baris].sort((a, b) => {
        const selisih = bandingkanNilai(accessor(a, urut.kolom), accessor(b, urut.kolom));
        return urut.naik ? selisih : -selisih;
    });
}
