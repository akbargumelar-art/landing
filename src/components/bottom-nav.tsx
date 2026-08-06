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
 * Empat menu utama ditaruh langsung di bar; sisanya masuk ke sheet "Lainnya". Enam item
 * sekaligus akan menyisakan sekitar 60px per item di layar 360px, terlalu rapat untuk
 * disentuh dengan nyaman.
 */

const menuUtama = [
    { href: "/", label: "Beranda", Icon: Home },
    { href: "/program", label: "Program", Icon: Ticket },
    { href: "/indihome", label: "IndiHome", Icon: Wifi },
    { href: "/mitra", label: "Mitra", Icon: Store },
];

const menuLainnya = [
    { href: "/cuan", label: "Kalkulator Cuan", Icon: Calculator },
    { href: "/lokasi-kontak", label: "Lokasi & Kontak", Icon: MapPin },
];

const semuaMenu = [...menuUtama, ...menuLainnya];

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

export function BottomNav() {
    const pathname = usePathname();
    const [open, setOpen] = React.useState(false);
    const aktif = hrefAktif(pathname);
    const lainnyaAktif = menuLainnya.some((menu) => menu.href === aktif);

    return (
        <>
            <nav
                aria-label="Navigasi utama"
                // pb pakai safe-area supaya tidak tertutup indikator home iPhone.
                className="fixed inset-x-0 bottom-0 z-50 md:hidden pb-[env(safe-area-inset-bottom)]"
            >
                <div className="mx-3 mb-3 rounded-2xl border border-black/5 bg-white/95 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md">
                    <ul className="flex items-stretch justify-around">
                        {menuUtama.map(({ href, label, Icon }) => {
                            const ini = aktif === href;
                            return (
                                <li key={href} className="flex-1">
                                    <Link
                                        href={href}
                                        aria-current={ini ? "page" : undefined}
                                        className={`flex h-16 flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${ini ? "text-red-600" : "text-gray-500"
                                            }`}
                                    >
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
                                className={`flex h-16 w-full flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${lainnyaAktif ? "text-red-600" : "text-gray-500"
                                    }`}
                            >
                                <MoreHorizontal className={`h-5 w-5 ${lainnyaAktif ? "stroke-[2.5]" : ""}`} />
                                <span className="text-[10px] font-semibold leading-none">Lainnya</span>
                            </button>
                        </li>
                    </ul>
                </div>
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
