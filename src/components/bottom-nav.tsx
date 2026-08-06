"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Home, MapPin, MoreHorizontal, Store, Ticket, Wifi } from "lucide-react";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/components/ui/sheet";

/**
 * Navigasi bawah ala aplikasi untuk ponsel.
 *
 * Hanya tampil di bawah 768px (`md:hidden`). Tablet dan laptop kecil tetap memakai tombol
 * hamburger di navbar, dan desktop tetap memakai tab di atas -- jadi perilaku yang sudah ada
 * di layar besar tidak berubah sama sekali.
 *
 * Bar-nya menempel penuh ke tepi bawah layar (tanpa jarak samping maupun bawah), dengan
 * Home di tengah sebagai tombol nyala api yang menonjol ke atas.
 */

/** Dua menu di kiri Home. */
const menuKiri = [
    { href: "/indihome", label: "IndiHome", Icon: Wifi },
    { href: "/program", label: "Program", Icon: Ticket },
];

/** Dua slot di kanan Home; "Lainnya" ditangani terpisah karena membuka sheet. */
const menuKanan = [
    { href: "/mitra", label: "Mitra", Icon: Store },
];

const menuLainnya = [
    { href: "/cuan", label: "Kalkulator Cuan", Icon: Calculator },
    { href: "/lokasi-kontak", label: "Lokasi & Kontak", Icon: MapPin },
];

const BERANDA = "/";
const semuaMenu = [
    { href: BERANDA },
    ...menuKiri,
    ...menuKanan,
    ...menuLainnya,
];

/**
 * Menentukan menu mana yang sedang aktif.
 *
 * Memakai pencocokan awalan TERPANJANG, bukan `startsWith` pertama yang cocok. Tanpa itu
 * "/" akan cocok dengan segalanya, dan membuka "/mitra/program/x" akan menyalakan dua menu
 * sekaligus -- bug yang sama pernah terjadi di sidebar admin (lihat docs/session.md Fase 2).
 */
function hrefAktif(pathname: string): string | null {
    let terbaik: string | null = null;
    for (const menu of semuaMenu) {
        const cocok = menu.href === "/" ? pathname === "/" : pathname.startsWith(menu.href);
        if (cocok && (terbaik === null || menu.href.length > terbaik.length)) {
            terbaik = menu.href;
        }
    }
    return terbaik;
}

/**
 * Bentuk nyala api mengikuti logo, digambar sebagai SVG supaya lengkungannya terkendali.
 * Meniru siluet logo: ujung lancip di atas, badan membulat, lalu meruncing lembut di bawah.
 * Gradiennya merah di atas menuju jingga-kuning di bawah, seperti pada logo.
 */
function IkonNyalaApi() {
    return (
        <svg viewBox="0 0 64 68" className="h-full w-full" aria-hidden focusable="false">
            <defs>
                {/* Arah gradien mengikuti logo: merah di kanan-atas turun ke kuning di kiri-bawah. */}
                <linearGradient id="nyala-api-bottomnav" x1="0.72" y1="0.05" x2="0.28" y2="1">
                    <stop offset="0%" stopColor="#e60012" />
                    <stop offset="42%" stopColor="#f42a24" />
                    <stop offset="70%" stopColor="#ff7a00" />
                    <stop offset="100%" stopColor="#ffcc00" />
                </linearGradient>
            </defs>
            {/* Siluet tetes air/nyala api: ujung lancip di atas sedikit condong ke kanan,
                badan melebar, dasar membulat penuh. Sengaja dibuat tegak dan lebar supaya
                sebangun dengan logo, bukan melengkung seperti koma. */}
            <path
                d="M35 2c9.5 12.5 21 22.5 21 36.5C56 52 45.2 63 32 63S8 52 8 38.5C8 24.5 24 14.5 35 2z"
                fill="url(#nyala-api-bottomnav)"
            />
        </svg>
    );
}

export function BottomNav() {
    const pathname = usePathname();
    const [open, setOpen] = React.useState(false);
    const aktif = hrefAktif(pathname);
    const lainnyaAktif = menuLainnya.some((menu) => menu.href === aktif);
    const berandaAktif = aktif === BERANDA;

    const kelasItem = (ini: boolean) =>
        `flex h-16 w-full flex-col items-center justify-center gap-1 transition-colors ${ini ? "text-red-600" : "text-gray-500"
        }`;

    return (
        <>
            <nav
                aria-label="Navigasi utama"
                // Menempel penuh ke tepi bawah: tanpa margin samping maupun bawah.
                // Padding safe-area tetap dipakai supaya tidak tertutup indikator home iPhone.
                className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 backdrop-blur-md md:hidden"
            >
                <ul className="flex items-end justify-around pb-[env(safe-area-inset-bottom)]">
                    {menuKiri.map(({ href, label, Icon }) => {
                        const ini = aktif === href;
                        return (
                            <li key={href} className="flex-1">
                                <Link href={href} aria-current={ini ? "page" : undefined} className={kelasItem(ini)}>
                                    <Icon className={`h-5 w-5 ${ini ? "stroke-[2.5]" : ""}`} />
                                    <span className="text-[10px] font-semibold leading-none">{label}</span>
                                </Link>
                            </li>
                        );
                    })}

                    {/* Home dibedakan: tombol nyala api yang menonjol ke atas dari bar. */}
                    <li className="flex-1">
                        <Link
                            href={BERANDA}
                            aria-current={berandaAktif ? "page" : undefined}
                            aria-label="Home"
                            className="flex h-16 w-full flex-col items-center justify-end gap-1 pb-2"
                        >
                            <span className="relative -mt-7 block h-[54px] w-[54px] drop-shadow-[0_3px_6px_rgba(230,0,18,0.28)]">
                                <IkonNyalaApi />
                                {/* Diletakkan pada 57% tinggi, bukan 50%: pusat massa nyala api ada
                                    di badan bawah, sementara bagian atasnya meruncing. Ditengahkan
                                    ke 50% membuat ikon terlihat melayang di ujung lancipnya. */}
                                <Home
                                    className="absolute left-1/2 top-[57%] h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 text-white"
                                    strokeWidth={2.5}
                                />
                            </span>
                            <span
                                className={`text-[10px] font-semibold leading-none ${berandaAktif ? "text-red-600" : "text-gray-500"
                                    }`}
                            >
                                Home
                            </span>
                        </Link>
                    </li>

                    {menuKanan.map(({ href, label, Icon }) => {
                        const ini = aktif === href;
                        return (
                            <li key={href} className="flex-1">
                                <Link href={href} aria-current={ini ? "page" : undefined} className={kelasItem(ini)}>
                                    <Icon className={`h-5 w-5 ${ini ? "stroke-[2.5]" : ""}`} />
                                    <span className="text-[10px] font-semibold leading-none">{label}</span>
                                </Link>
                            </li>
                        );
                    })}

                    <li className="flex-1">
                        <button
                            type="button"
                            onClick={() => setOpen(true)}
                            aria-haspopup="dialog"
                            aria-expanded={open}
                            className={kelasItem(lainnyaAktif)}
                        >
                            <MoreHorizontal className={`h-5 w-5 ${lainnyaAktif ? "stroke-[2.5]" : ""}`} />
                            <span className="text-[10px] font-semibold leading-none">Lainnya</span>
                        </button>
                    </li>
                </ul>
            </nav>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                    <SheetTitle className="text-base">Menu Lainnya</SheetTitle>
                    {/* Radix memperingatkan bila DialogContent tanpa deskripsi. Disembunyikan
                        secara visual tetapi tetap dibacakan pembaca layar. */}
                    <SheetDescription className="sr-only">
                        Menu tambahan yang tidak muat di navigasi bawah.
                    </SheetDescription>
                    <div className="mt-4 flex flex-col gap-1">
                        {menuLainnya.map(({ href, label, Icon }) => {
                            const ini = aktif === href;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={() => setOpen(false)}
                                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${ini ? "bg-red-50 text-red-600" : "text-gray-700 hover:bg-gray-50"
                                        }`}
                                >
                                    <Icon className="h-5 w-5" />
                                    {label}
                                </Link>
                            );
                        })}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
