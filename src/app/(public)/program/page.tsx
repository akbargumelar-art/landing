"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Calendar, Users, UserCheck } from "lucide-react";

interface Program {
    id: string;
    slug: string;
    title: string;
    description: string;
    period: string;
    thumbnail?: string;
    category: string;
}

export default function ProgramPage() {
    const [filterCategory, setFilterCategory] = useState("");
    const [programs, setPrograms] = useState<Program[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        fetch("/api/public/programs")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setPrograms(data);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, []);

    const filtered = filterCategory
        ? programs.filter((p) => p.category === filterCategory)
        : programs;

    return (
        <div className="min-h-screen">
            {/* Header */}
            <section className="h-[520px] md:h-[620px] bg-gradient-to-br from-red-600 via-red-500 to-orange-500 relative overflow-hidden flex items-center">
                <div className="absolute inset-0">
                    <div className="absolute top-10 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-10 left-10 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute top-20 left-1/3 w-16 h-16 border-2 border-white/10 rounded-2xl rotate-12 animate-float" />
                    <div className="absolute bottom-16 right-1/4 w-10 h-10 border-2 border-white/10 rounded-full animate-float-delayed" />
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
                {/* Wave divider */}
                <div className="wave-divider">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path
                            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C59.71,118.11,130.83,141.14,321.39,56.44Z"
                            fill="#ffffff"
                        />
                    </svg>
                </div>
            </section>

            {/* Program Grid */}
            <section className="py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    {/* Category Filter Tabs */}
                    <div className="flex justify-center gap-3 mb-10">
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
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filtered.map((program) => (
                                <Card
                                    key={program.id}
                                    className="overflow-hidden group border-0 shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
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
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                                        {/* Category Badge */}
                                        <div className="absolute top-3 left-3">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${program.category === "mitra"
                                                ? "bg-orange-500 text-white"
                                                : "bg-red-600 text-white"
                                                }`}>
                                                {program.category === "mitra" ? "Mitra Outlet" : "Pelanggan"}
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
                                        <Link href={`/program/${program.slug}`}>
                                            <Button className="btn-pill w-full font-semibold cursor-pointer">
                                                Lihat Detail
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
