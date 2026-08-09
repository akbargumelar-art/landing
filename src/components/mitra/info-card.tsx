import React from "react";

/**
 * Kartu satu field pada profil outlet, dipakai halaman publik maupun Detail Terverifikasi.
 *
 * Disatukan karena keduanya sempat punya salinan yang nyaris sama lalu berbeda sendiri:
 * versi publik sudah dirapatkan untuk ponsel sementara versi detail masih satu kolom.
 * Ukurannya dirapatkan HANYA di layar sempit; dari sm ke atas kembali seperti semula.
 */
export function InfoCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="rounded-lg border bg-gray-50 p-3 sm:p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:gap-2 sm:text-xs">
                {icon}{label}
            </p>
            {/* break-words: nilai seperti "Jalaksana, Kuningan" melebihi setengah lebar layar
                ponsel, dan tanpa ini teksnya menonjol keluar kartu alih-alih turun baris. */}
            <p className="mt-1 break-words text-sm font-semibold text-gray-950 sm:text-base">{value}</p>
        </div>
    );
}
