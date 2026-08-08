"use client";

import React from "react";
import { ArrowUp } from "lucide-react";

/** Muncul setelah gulir sejauh ini; di bawah itu tombolnya hanya menutupi konten. */
const AMBANG_MUNCUL = 400;

/**
 * Tombol kembali ke atas untuk seluruh halaman, dipasang sekali di layout root.
 *
 * Posisinya diangkat pada layar sempit karena BottomNav publik menempel di bawah
 * (fixed bottom-0, tinggi 64 px, hanya di bawah 768px). Tanpa itu tombol ini tertimpa
 * dan tidak bisa ditekan justru di perangkat yang paling butuh.
 */
export function BackToTop() {
    const [tampil, setTampil] = React.useState(false);

    React.useEffect(() => {
        const periksa = () => setTampil(window.scrollY > AMBANG_MUNCUL);

        // Dijalankan sekali di awal: halaman bisa dibuka dalam keadaan sudah tergulir,
        // misalnya saat kembali dari halaman lain atau membuka tautan berjangkar.
        periksa();
        window.addEventListener("scroll", periksa, { passive: true });
        return () => window.removeEventListener("scroll", periksa);
    }, []);

    if (!tampil) return null;

    return (
        <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Kembali ke atas halaman"
            title="Kembali ke atas"
            className="fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-all hover:bg-red-700 hover:shadow-xl active:scale-95 md:bottom-6 md:right-6"
        >
            <ArrowUp className="h-5 w-5" />
        </button>
    );
}
