"use client";

import React, { useState, useEffect, useCallback } from "react";

interface HeroSlide {
    id: string;
    title: string;
    subtitle: string;
    cta: string;
    ctaLink: string;
    bgColor: string;
    imageUrl?: string;
}

interface Program {
    id: string;
    slug: string;
    title: string;
    description: string;
    period: string;
    thumbnail?: string;
    category: string;
}
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    ChevronLeft,
    ChevronRight,
    MapPin,
    Users,
    Award,
    ArrowRight,
    ExternalLink,
    Zap,
    Gift,
    Shield,
} from "lucide-react";

function WaveDivider({ fill = "#ffffff", flip = false }: { fill?: string; flip?: boolean }) {
    return (
        <div className={flip ? "wave-divider-top" : "wave-divider"}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                <path
                    d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C59.71,118.11,130.83,141.14,321.39,56.44Z"
                    fill={fill}
                />
            </svg>
        </div>
    );
}

function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
    const [current, setCurrent] = useState(0);

    const next = useCallback(() => {
        if (!slides || slides.length === 0) return;
        setCurrent((prev) => (prev + 1) % slides.length);
    }, [slides]);

    const prev = () => {
        if (!slides || slides.length === 0) return;
        setCurrent(
            (prev) => (prev - 1 + slides.length) % slides.length
        );
    };

    useEffect(() => {
        const timer = setInterval(next, 5000);
        return () => clearInterval(timer);
    }, [next]);

    if (!slides || slides.length === 0) {
        return <div className="h-[520px] md:h-[620px] bg-red-600 flex items-center justify-center text-white">Loading...</div>;
    }

    return (
        <section className="relative overflow-hidden">
            <div className="relative h-[520px] md:h-[620px]">
                {slides.map((slide, index) => (
                    <div
                        key={slide.id}
                        className={`absolute inset-0 transition-all duration-700 ease-in-out ${index === current
                            ? "opacity-100 translate-x-0"
                            : index < current
                                ? "opacity-0 -translate-x-full"
                                : "opacity-0 translate-x-full"
                            }`}
                    >
                        <div
                            className={`h-full w-full ${!slide.imageUrl ? 'bg-gradient-to-br ' + slide.bgColor : 'bg-gray-900'} flex items-center relative overflow-hidden`}
                        >
                            {slide.imageUrl && (
                                <>
                                    <Image
                                        src={slide.imageUrl}
                                        alt={slide.title || "Banner"}
                                        fill
                                        className="object-cover absolute inset-0 z-0"
                                        priority={index === 0}
                                        unoptimized={true}
                                    />
                                    <div className="absolute inset-0 bg-black/50 z-0" />
                                </>
                            )}
                            {/* Decorative elements */}
                            <div className="absolute inset-0 overflow-hidden">
                                <div className="absolute top-10 right-10 w-80 h-80 bg-white/5 rounded-full blur-3xl animate-float" />
                                <div className="absolute bottom-20 left-10 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float-delayed" />
                                <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-white/3 rounded-full blur-3xl" />
                                {/* Geometric shapes */}
                                <div className="absolute top-20 right-[20%] w-20 h-20 border-2 border-white/10 rounded-2xl rotate-12 animate-float" />
                                <div className="absolute bottom-32 right-[30%] w-14 h-14 border-2 border-white/10 rounded-full animate-float-delayed" />
                                <div className="absolute top-1/2 left-[15%] w-8 h-8 bg-white/10 rounded-lg rotate-45" />
                            </div>

                            <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
                                <div className="max-w-2xl">
                                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 leading-tight drop-shadow-lg">
                                        {slide.title}
                                    </h1>
                                    <p className="text-lg md:text-xl text-white/85 mb-8 leading-relaxed">
                                        {slide.subtitle}
                                    </p>
                                    <Link href={slide.ctaLink}>
                                        <Button
                                            size="lg"
                                            className="btn-pill bg-white text-red-600 hover:bg-gray-100 shadow-xl text-base font-bold px-10 py-3 h-auto hover:shadow-2xl transition-all duration-300 cursor-pointer"
                                        >
                                            {slide.cta}
                                            <ArrowRight className="ml-2 h-5 w-5" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Wave divider at bottom */}
            <WaveDivider fill="#ffffff" />

            {/* Navigation arrows */}
            <button
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-all duration-300 cursor-pointer hover:scale-110"
                aria-label="Previous slide"
            >
                <ChevronLeft className="h-6 w-6" />
            </button>
            <button
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-all duration-300 cursor-pointer hover:scale-110"
                aria-label="Next slide"
            >
                <ChevronRight className="h-6 w-6" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-16 md:bottom-24 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrent(index)}
                        className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${index === current ? "w-10 bg-white shadow-lg" : "w-2.5 bg-white/50 hover:bg-white/70"
                            }`}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>
        </section>
    );
}

function AboutSection({ aboutContent }: { aboutContent?: string }) {
    const features = [
        {
            icon: MapPin,
            title: "3 Wilayah Operasional",
            desc: "Kab. Cirebon, Kota Cirebon, Kab. Kuningan",
            color: "bg-red-500",
        },
        {
            icon: Award,
            title: "Mitra Resmi Telkomsel",
            desc: "Authorized Partner dengan layanan terbaik",
            color: "bg-red-600",
        },
        {
            icon: Users,
            title: "Ribuan Mitra Outlet",
            desc: "Jaringan outlet terpercaya di seluruh wilayah",
            color: "bg-orange-500",
        },
    ];

    const defaultAbout = `Sebagai Telkomsel Authorized Partner, kami berkomitmen untuk
                        menghadirkan layanan telekomunikasi terbaik dan program-program
                        unggulan bagi pelanggan serta mitra outlet di seluruh wilayah
                        operasional kami.`;

    return (
        <section className="py-20 bg-white">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-14">
                    <span className="inline-block text-primary text-sm font-bold uppercase tracking-widest mb-3">
                        Tentang Kami
                    </span>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
                        PT Agrabudi Komunika
                    </h2>
                    {aboutContent ? (
                        <div
                            className="mt-4 max-w-2xl mx-auto text-muted-foreground leading-relaxed text-lg"
                            dangerouslySetInnerHTML={{ __html: aboutContent }}
                        />
                    ) : (
                        <p className="mt-4 max-w-2xl mx-auto text-muted-foreground leading-relaxed text-lg">
                            {defaultAbout}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <Card
                            key={index}
                            className="border-0 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white"
                        >
                            <CardContent className="p-8 text-center">
                                <div className={`w-16 h-16 rounded-2xl ${feature.color} flex items-center justify-center mx-auto mb-5 shadow-lg`}>
                                    <feature.icon className="h-8 w-8 text-white" />
                                </div>
                                <h3 className="font-bold text-foreground mb-2 text-lg">
                                    {feature.title}
                                </h3>
                                <p className="text-muted-foreground">{feature.desc}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}

interface QuickCard {
    label: string;
    icon: string;
    link: string;
    color: string;
}

function QuickAccessSection({ quickCards }: { quickCards: QuickCard[] | null }) {
    const defaultItems = [
        { icon: Zap, label: "Hot Promo", color: "from-red-500 to-red-600", link: "/program" },
        { icon: Gift, label: "Undian Berhadiah", color: "from-orange-500 to-red-500", link: "/program" },
        { icon: Shield, label: "Paket Hemat", color: "from-red-600 to-red-700", link: "/program" },
        { icon: Users, label: "Mitra Outlet", color: "from-red-500 to-orange-500", link: "/program" },
    ];

    const displayItems = quickCards && quickCards.length > 0 ? quickCards : defaultItems;

    return (
        <section className="py-10 bg-gray-50/80">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {displayItems.map((item: any, i: number) => {
                        const isDynamic = quickCards && quickCards.length > 0;
                        return (
                            <Link href={item.link || "/program"} key={i} className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer group">
                                <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 overflow-hidden`}>
                                    {isDynamic ? (
                                        item.icon && (item.icon.startsWith("/") || item.icon.startsWith("http")) ? (
                                            <Image src={item.icon} alt={item.label} fill className="object-contain p-2" unoptimized={true} />
                                        ) : (
                                            <span className="text-2xl text-white">{item.icon}</span>
                                        )
                                    ) : (
                                        <item.icon className="h-7 w-7 text-white" />
                                    )}
                                </div>
                                <span className="text-sm font-bold text-foreground text-center">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function ProgramPreview({ programs }: { programs: Program[] }) {
    return (
        <section className="py-20 bg-white relative">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-14">
                    <span className="inline-block text-primary text-sm font-bold uppercase tracking-widest mb-3">
                        Program Kami
                    </span>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
                        Program Unggulan
                    </h2>
                </div>

                <div className="flex flex-wrap justify-center gap-6">
                    {programs.slice(0, 4).map((program) => (
                        <Card
                            key={program.id}
                            className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)] overflow-hidden group border-0 shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                        >
                            <div className="h-44 relative overflow-hidden">
                                {program.thumbnail ? (
                                    <Image
                                        src={program.thumbnail}
                                        alt={program.title}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-red-500 via-red-600 to-orange-500 relative">
                                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300" />
                                        <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
                                        <div className="absolute -bottom-2 -left-2 w-16 h-16 bg-white/10 rounded-full" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <span className="text-2xl font-extrabold text-white">
                                                    {program.title.charAt(0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* Category Badge */}
                                <div className="absolute bottom-3 right-3">
                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide shadow-md ${program.category === "mitra"
                                        ? "bg-orange-500 text-white"
                                        : "bg-red-600 text-white"
                                        }`}>
                                        {program.category === "mitra" ? "Mitra Outlet" : "Pelanggan"}
                                    </span>
                                </div>
                            </div>
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
                                    <Calendar className="h-3 w-3" />
                                    <span>{program.period}</span>
                                </div>
                                <h3 className="font-bold text-foreground mb-2 text-sm leading-snug line-clamp-2">
                                    {program.title}
                                </h3>
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                                    {program.description}
                                </p>
                                <Link href={`/program/${program.slug}`}>
                                    <Button variant="outline" size="sm" className="btn-pill w-full font-semibold hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 cursor-pointer">
                                        Lihat Detail
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="text-center mt-10">
                    <Link href="/program">
                        <Button variant="outline" size="lg" className="btn-pill font-semibold px-8 hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 cursor-pointer">
                            Lihat Semua Program
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}

const defaultOffices: { city?: string; label?: string; address?: string; phone?: string; mapUrl?: string; image?: string }[] = [
    {
        city: "CIREBON",
        label: "Kantor Pusat Cirebon",
        address: "Jl. Pemuda Raya No.21B, Sunyaragi, Kec. Kesambi, Kota Cirebon, Jawa Barat 45132",
        phone: "+62 851-6882-2280",
        mapUrl: "https://www.google.com/maps/search/Jl.+Pemuda+Raya+No.21B+Sunyaragi+Kesambi+Kota+Cirebon",
    },
    {
        city: "KUNINGAN",
        label: "Kantor Cabang Kuningan",
        address: "Jl. Siliwangi No.45, Purwawinangun, Kec. Kuningan, Kabupaten Kuningan, Jawa Barat 45512",
        phone: "+62 851-6882-2280",
        mapUrl: "https://www.google.com/maps/search/Jl.+Siliwangi+No.45+Purwawinangun+Kuningan",
    },
];

function LokasiKantor() {
    const [offices, setOffices] = useState(defaultOffices);

    useEffect(() => {
        fetch("/api/public/settings")
            .then((r) => r.json())
            .then((data) => {
                if (data.office_data) {
                    try {
                        const parsed = JSON.parse(data.office_data);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setOffices(parsed.map((o: { city?: string; label?: string; address?: string; phone?: string; mapUrl?: string; image?: string }, i: number) => ({
                                city: o.city || defaultOffices[i]?.city || `KANTOR ${i + 1}`,
                                label: o.label || defaultOffices[i]?.label || `Kantor ${i + 1}`,
                                image: o.image || defaultOffices[i]?.image,
                                address: o.address || "",
                                phone: o.phone || data.footer_phone || defaultOffices[0].phone,
                                mapUrl: o.mapUrl || "",
                            })));
                        }
                    } catch { /* use defaults */ }
                }
            })
            .catch(() => { });
    }, []);

    return (
        <section className="py-20 bg-gray-50/80">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-14">
                    <span className="inline-block text-primary text-sm font-bold uppercase tracking-widest mb-3">
                        Kantor Kami
                    </span>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
                        Lokasi Kantor
                    </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {offices.map((office) => (
                        <Card
                            key={office.city}
                            className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white flex flex-col sm:flex-row h-full"
                        >
                            {/* Photo (Portrait Mode) */}
                            <div className={`relative h-64 sm:h-auto sm:w-2/5 shrink-0 overflow-hidden ${!office.image ? 'bg-gradient-to-br from-red-600 via-red-500 to-red-700' : ''}`}>
                                {office.image ? (
                                    <Image
                                        src={office.image as string}
                                        alt={office.label || "Kantor"}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        unoptimized={true}
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center z-10">
                                            <MapPin className="h-8 w-8 text-white" />
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-black/60 sm:from-black/40 to-transparent z-10" />
                                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold shadow-lg">
                                        <MapPin className="h-3 w-3" />
                                        {office.label}
                                    </span>
                                </div>
                                {/* Decorative */}
                                <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full z-0 pointer-events-none" />
                                <div className="absolute -bottom-2 -left-2 w-14 h-14 bg-white/10 rounded-full z-0 pointer-events-none" />
                            </div>

                            <CardContent className="p-6 space-y-4 flex flex-col justify-center flex-1">
                                {/* City Name */}
                                <h3 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                                    {office.city}
                                    <ArrowRight className="h-4 w-4 text-red-500" />
                                </h3>

                                {/* Address */}
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {office.address}
                                </p>

                                {/* Phone */}
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                                        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground line-clamp-1">{office.phone}</span>
                                </div>

                                {/* Separator */}
                                <div className="border-t border-red-500 w-16 my-1" />

                                {/* Map Link */}
                                <a
                                    href={office.mapUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors mt-auto pt-2"
                                >
                                    <MapPin className="h-4 w-4" />
                                    Lihat di Google Maps
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="text-center mt-10">
                    <Link href="/lokasi-kontak">
                        <Button variant="outline" size="lg" className="btn-pill font-semibold px-8 hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 cursor-pointer">
                            Semua Lokasi & Kontak
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}

function MitraSection() {
    return (
        <section className="relative overflow-hidden">
            {/* Red-Orange Gradient Background */}
            <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 py-24 relative">
                {/* Wave top */}
                <div className="wave-divider-top">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path
                            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C59.71,118.11,130.83,141.14,321.39,56.44Z"
                            fill="#f8f8f8"
                        />
                    </svg>
                </div>

                {/* Decorative */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute top-20 left-1/3 w-16 h-16 border-2 border-white/10 rounded-2xl rotate-12 animate-float" />

                <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl mx-auto text-center">
                        <span className="inline-block text-white/80 text-sm font-bold uppercase tracking-widest mb-3">
                            Program Mitra Outlet
                        </span>
                        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                            Bergabung Jadi Mitra Outlet Kami
                        </h2>
                        <p className="text-lg text-white/85 leading-relaxed mb-8">
                            Dapatkan keuntungan lebih dengan menjadi mitra outlet resmi
                            Telkomsel ABK Ciraya. Akses ke berbagai program promo, bonus, dan
                            dukungan penuh dari tim kami.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href="https://poin.abkciraya.cloud"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Button
                                    size="lg"
                                    className="btn-pill bg-white text-red-600 hover:bg-gray-100 shadow-xl text-base font-bold px-10 h-auto py-3 hover:shadow-2xl transition-all duration-300 cursor-pointer"
                                >
                                    Gabung Mitra Outlet
                                    <ExternalLink className="ml-2 h-5 w-5" />
                                </Button>
                            </a>
                            <Link href="/lokasi-kontak">
                                <Button
                                    size="lg"
                                    className="btn-pill border-2 border-white bg-transparent text-white hover:bg-white hover:text-red-600 text-base font-bold px-10 h-auto py-3 transition-all duration-300 cursor-pointer"
                                >
                                    Hubungi Kami
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function HomePage() {
    const [slides, setSlides] = useState<HeroSlide[]>([]);
    const [programsList, setProgramsList] = useState<Program[]>([]);
    const [aboutContent, setAboutContent] = useState<string>("");
    const [quickCards, setQuickCards] = useState<QuickCard[] | null>(null);

    useEffect(() => {
        fetch("/api/public/hero-slides")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setSlides(data);
            });

        fetch("/api/public/programs")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setProgramsList(data);
            });

        fetch("/api/public/settings")
            .then((res) => res.json())
            .then((data) => {
                if (data.about_content) setAboutContent(data.about_content);
                if (data.quick_access_cards) {
                    try {
                        setQuickCards(JSON.parse(data.quick_access_cards));
                    } catch { }
                }
            })
            .catch(() => { });
    }, []);

    return (
        <>
            <HeroCarousel slides={slides} />
            <QuickAccessSection quickCards={quickCards} />
            <AboutSection aboutContent={aboutContent} />
            <ProgramPreview programs={programsList} />
            <LokasiKantor />
            <MitraSection />
        </>
    );
}
