import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Tautan "kembali" untuk halaman detail publik.
 *
 * Sengaja memakai <Link> ke halaman induk, bukan router.back(). Halaman seperti profil
 * outlet sering dibuka langsung dari pemindaian QR atau tautan yang dibagikan, sehingga
 * riwayat browser bisa kosong dan router.back() tidak akan ke mana-mana. Tautan eksplisit
 * selalu bekerja, entah pengunjung datang dari daftar atau dari luar.
 *
 * Gaya visualnya menyalin pola yang sudah dipakai di halaman detail program dan detail
 * outlet, supaya tampilannya seragam.
 */
export function BackLink({
    href,
    label = "Kembali",
    className = "",
}: {
    href: string;
    label?: string;
    className?: string;
}) {
    return (
        <Link
            href={href}
            className={`inline-flex items-center gap-2 text-sm font-semibold text-red-600 transition-colors hover:text-red-700 ${className}`}
        >
            <ArrowLeft className="h-4 w-4" />
            {label}
        </Link>
    );
}
