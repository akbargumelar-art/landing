"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Calendar, Lock, Users, UserCheck } from "lucide-react";

interface Program {
    id: string;
    slug: string;
    title: string;
    description: string;
    period: string;
    thumbnail?: string;
    category: string;
    href: string;
}

interface MitraProgram {
    id: string;
    slug: string;
    name: string;
    descriptionMd?: string;
    thumbnailUrl?: string | null;
    periodStart: string;
    periodEnd: string;
}

function formatMitraPeriod(start: string, end: string) {
    const formatter = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
}

export default function ProgramPage() {
    const [filterCategory, setFilterCategory] = useState("");
    const [programs, setPrograms] = useState<Program[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        Promise.allSettled([
            fetch("/api/public/programs").then((res) => res.ok ? res.json() : []),
            fetch("/api/public/mitra/programs").then((res) => res.ok ? res.json() : { programs: [] }),
            fetch("/api/public/mitra/programs?targetType=SALESFORCE").then((res) => res.ok ? res.json() : { programs: [] }),
        ]).then(([legacyResult, mitraResult, salesforceResult]) => {
            const legacyPrograms = legacyResult.status === "fulfilled" && Array.isArray(legacyResult.value)
                ? legacyResult.value.map((program: Omit<Program, "href">) => ({ ...program, href: `/program/${program.slug}` }))
                : [];
            const mitraPrograms: MitraProgram[] = mitraResult.status === "fulfilled" && Array.isArray(mitraResult.value?.programs)
                ? mitraResult.value.programs
                : [];
            const normalizedMitra: Program[] = mitraPrograms.map((program) => ({
                id: `mitra:${program.id}`,
                slug: program.slug,
                title: program.name,
                description: program.descriptionMd || "Program dan leaderboard Mitra Outlet ABK Ciraya.",
                period: formatMitraPeriod(program.periodStart, program.periodEnd),
                thumbnail: program.thumbnailUrl || undefined,
                category: "mitra",
                href: `/mitra/program/${program.slug}`,
            }));
            const salesforcePrograms: MitraProgram[] = salesforceResult.status === "fulfilled" && Array.isArray(salesforceResult.value?.programs)
                ? salesforceResult.value.programs
                : [];
            // Program salesforce tampil di daftar ini, tetapi isinya baru terbuka setelah
            // verifikasi OTP di halaman detailnya.
            const normalizedSalesforce: Program[] = salesforcePrograms.map((program) => ({
                id: `sf:${program.id}`,
                slug: program.slug,
                title: program.name,
                description: program.descriptionMd || "Program dan papan pencapaian tim salesforce.",
                period: formatMitraPeriod(program.periodStart, program.periodEnd),
                thumbnail: program.thumbnailUrl || undefined,
                category: "salesforce",
                href: `/mitra/program-sf/${program.slug}`,
            }));

            const mitraSlugs = new Set(normalizedMitra.map((program) => program.slug));
            const convergedLegacy = legacyPrograms.filter((program: Program) => !(program.category === "mitra" && mitraSlugs.has(program.slug)));
            setPrograms([...convergedLegacy, ...normalizedMitra, ...normalizedSalesforce]);
            setIsLoading(false);
        });
    }, []);

    const filtered = filterCategory
        ? programs.filter((p) => p.category === filterCategory)
        : programs;

    return (
        <div className="min-h-screen">
            {/* Header */}
            <section className="h-[360px] md:h-[480px] bg-gradient-to-br from-red-600 via-red-500 to-orange-500 relative overflow-hidden flex items-center">
                <div className="absolute inset-0">
                    <div className="absolute top-10 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-10 left-10 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center w-full">
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4">
                        Program Kami
                    </h1>
                    <p className="text-lg md:text-xl text-white/85 max-w-2xl mx-auto">
                        Temukan berbagai program menarik dan promo terbaru dari Telkomsel
                        melalui ABK Ciraya
                    </p>
                </div>
            </section>

            {/* Program Grid */}
            <section className="py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    {/* Category Filter Tabs */}
                    <div className="flex flex-wrap justify-center gap-3 mb-10">
                        <button
                            onClick={() => setFilterCategory("")}
                            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${!filterCategory ? "bg-red-600 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                        >
                            Semua Program
                        </button>
                        <button
                            onClick={() => setFilterCategory("pelanggan")}
                            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${filterCategory === "pelanggan" ? "bg-red-600 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                        >
                            <UserCheck className="h-4 w-4" /> Program Pelanggan
                        </button>
                        <button
                            onClick={() => setFilterCategory("mitra")}
                            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${filterCategory === "mitra" ? "bg-red-600 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                        >
                            <Users className="h-4 w-4" /> Program Mitra Outlet
                        </button>
                        <button
                            onClick={() => setFilterCategory("salesforce")}
                            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${filterCategory === "salesforce" ? "bg-red-600 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                        >
                            <Lock className="h-4 w-4" /> Program Salesforce
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                        </div>
                    ) : (
                        filtered.length === 0 ? (
                            <div className="rounded-lg border bg-white px-5 py-12 text-center text-sm text-muted-foreground">
                                Belum ada program pada kategori ini.
                            </div>
                        ) : (
                            <div className="flex flex-wrap justify-center gap-8">
                                {filtered.map((program) => (
                                <Card
                                    key={program.id}
                                    className="w-full sm:w-[calc(50%-16px)] lg:w-[calc(33.333%-22px)] overflow-hidden group border-0 shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                                >
                                    <div className="h-48 relative overflow-hidden">
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
                                                    <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                        <span className="text-3xl font-extrabold text-white">
                                                            {program.title.charAt(0)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {/* Category Badge */}
                                        <div className="absolute bottom-3 right-3">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-md ${program.category === "mitra"
                                                ? "bg-orange-500 text-white"
                                                : program.category === "salesforce"
                                                    ? "bg-gray-900 text-white"
                                                    : "bg-red-600 text-white"
                                                }`}>
                                                {program.category === "mitra" ? "Mitra Outlet" : program.category === "salesforce" ? "Salesforce" : "Pelanggan"}
                                            </span>
                                        </div>
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                                            <Calendar className="h-3.5 w-3.5" />
                                            <span>{program.period}</span>
                                        </div>
                                        <h3 className="font-bold text-foreground mb-2 text-lg">
                                            {program.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-3 mb-6">
                                            {program.description}
                                        </p>
                                        <Link href={program.href}>
                                            <Button className="w-full font-semibold cursor-pointer">
                                                Lihat Detail
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </CardContent>
                                </Card>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </section>
        </div>
    );
}
