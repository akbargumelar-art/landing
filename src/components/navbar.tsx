"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetTitle,
} from "@/components/ui/sheet";

const navLinks = [
    { href: "/", label: "BERANDA" },
    { href: "/program", label: "PROGRAM" },
    { href: "/lokasi-kontak", label: "LOKASI & KONTAK" },
];

export function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
                ? "bg-white shadow-lg"
                : "bg-white/90 backdrop-blur-sm"
                }`}
        >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 md:h-18 items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-red-500 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-red-200">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                </svg>
                            </div>
                            <span className="text-base md:text-lg font-extrabold text-foreground tracking-tight uppercase">
                                Agrabudi Komunika
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`px-4 py-2 text-sm font-semibold tracking-wide transition-all duration-200 relative ${pathname === link.href
                                    ? "text-primary"
                                    : "text-foreground/70 hover:text-primary"
                                    }`}
                            >
                                {link.label}
                                {pathname === link.href && (
                                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
                                )}
                            </Link>
                        ))}
                    </nav>

                    {/* Mobile Menu */}
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden"
                                aria-label="Open menu"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-72">
                            <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
                            <div className="flex flex-col gap-1 mt-8">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setOpen(false)}
                                        className={`px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 ${pathname === link.href
                                            ? "text-primary bg-red-50"
                                            : "text-foreground/70 hover:text-primary hover:bg-red-50/50"
                                            }`}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
