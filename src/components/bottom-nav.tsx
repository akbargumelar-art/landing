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
 * Tombol tengah berbentuk lingkaran timbul.
 *
 * Percobaan meniru bentuk nyala api pada logo tidak pernah terlihat meyakinkan pada ukuran
 * 54px -- lengkungannya jadi ambigu dan malah terbaca seperti bentuk lain. Lingkaran dipilih
 * karena bentuknya tegas di ukuran kecil, dan cincin putih di sekelilingnya membuatnya
 * terbaca "mengambang" di atas bar meskipun bar-nya menempel rata ke tepi layar.
 *
 * Warna merek tetap dipertahankan lewat gradien merah ke jingga.
 */
function TombolHomeTengah() {
    return (
        <span
            className="-mt-7 flex h-[56px] w-[56px] items-center justify-center rounded-full
                       bg-gradient-to-br from-[#f5222d] via-[#fa4b1e] to-[#ff8a00]
                       shadow-[0_6px_16px_-4px_rgba(230,0,18,0.5)]
                       ring-4 ring-white transition-transform active:scale-95"
        >
            <Home className="h-[26px] w-[26px] text-white" strokeWidth={2.4} />
        </span>
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
                            <TombolHomeTengah />
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
