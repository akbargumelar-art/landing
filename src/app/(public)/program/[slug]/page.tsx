"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    ArrowLeft,
    Calendar,
    CheckCircle,
    ListOrdered,
    Trophy,
    Users,
} from "lucide-react";

interface Program {
    id: string;
    title: string;
    slug: string;
    period: string;
    content: string;
    terms: string[] | string;
    mechanics: string[] | string;
}

interface Winner {
    id: string;
    name: string;
    phone?: string;
    outlet?: string;
    week?: string;
    programId: string;
}

interface Participant {
    name: string;
    phone: string;
}

function maskName(name: string): string {
    if (!name) return "***";
    if (name.length <= 3) return "***";
    return name.slice(0, name.length - 3) + "***";
}

function maskPhone(phone: string): string {
    if (!phone) return "***";
    if (phone.length <= 3) return "***";
    return phone.slice(0, phone.length - 3) + "***";
}

export default function ProgramDetailPage() {
    const params = useParams();
    const slug = params.slug as string;

    const [program, setProgram] = useState<Program | null>(null);
    const [programWinners, setProgramWinners] = useState<Winner[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        Promise.all([
            fetch("/api/public/programs").then(res => res.json()),
            fetch("/api/public/winners").then(res => res.json()).catch(() => []),
            fetch(`/api/public/programs/${slug}/participants`).then(res => res.json()).catch(() => []),
        ]).then(([programsData, winnersData, participantsData]) => {
            if (Array.isArray(programsData)) {
                const foundProg = programsData.find((p: Program) => p.slug === slug);
                if (foundProg) {
                    try {
                        if (typeof foundProg.terms === "string") foundProg.terms = JSON.parse(foundProg.terms);
                        if (typeof foundProg.mechanics === "string") foundProg.mechanics = JSON.parse(foundProg.mechanics);
                    } catch { /* ignore parse errors */ }
                    setProgram(foundProg);

                    if (Array.isArray(winnersData)) {
                        setProgramWinners(winnersData.filter((w: Winner) => w.programId === foundProg.id));
                    }
                }
            }
            if (Array.isArray(participantsData)) {
                setParticipants(participantsData);
            }
            setIsLoading(false);
        }).catch(() => setIsLoading(false));
    }, [slug]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
        );
    }

    if (!program) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Program Tidak Ditemukan</h1>
                    <Link href="/program">
                        <Button variant="outline" className="btn-pill cursor-pointer">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Kembali ke Daftar Program
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <section className="h-[520px] md:h-[620px] bg-gradient-to-br from-red-600 via-red-500 to-orange-500 relative overflow-hidden flex items-center">
                <div className="absolute inset-0">
                    <div className="absolute top-10 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute top-20 left-1/4 w-16 h-16 border-2 border-white/10 rounded-2xl rotate-12 animate-float" />
                </div>
                <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
                    <Link
                        href="/program"
                        className="inline-flex items-center text-white/80 hover:text-white text-sm mb-6 transition-colors font-medium"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Kembali ke Daftar Program
                    </Link>
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4">
                        {program.title}
                    </h1>
                    <div className="flex items-center gap-2 text-white/80 text-lg">
                        <Calendar className="h-5 w-5" />
                        <span>{program.period}</span>
                    </div>
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

            {/* Content */}
            <section className="py-12">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-8">
                            <div>
                                <h2 className="text-xl font-bold text-foreground mb-4">
                                    Tentang Program
                                </h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    {program.content}
                                </p>
                            </div>

                            {/* Mechanics */}
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <ListOrdered className="h-4 w-4 text-primary" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground">
                                            Cara Mengikuti
                                        </h3>
                                    </div>
                                    <div className="space-y-3">
                                        {(program.mechanics as string[]).map((step, index) => (
                                            <div key={index} className="flex items-start gap-3">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shrink-0 mt-0.5">
                                                    <span className="text-xs font-bold text-white">
                                                        {index + 1}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{step}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <CheckCircle className="h-4 w-4 text-primary" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground">
                                            Syarat &amp; Ketentuan
                                        </h3>
                                    </div>
                                    <ul className="space-y-3">
                                        {(program.terms as string[]).map((term, index) => (
                                            <li
                                                key={index}
                                                className="flex items-start gap-2 text-sm text-muted-foreground"
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 mt-2 shrink-0" />
                                                {term}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-orange-50">
                                <CardContent className="p-6 text-center">
                                    <Badge className="mb-3 btn-pill">Aktif</Badge>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Ikuti program ini sekarang!
                                    </p>
                                    <Link href="/form-undian">
                                        <Button className="btn-pill w-full font-semibold cursor-pointer">Daftar Sekarang</Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Participants List */}
                    {participants.length > 0 && (
                        <div className="mt-16">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-extrabold text-foreground">
                                        Daftar Peserta
                                    </h2>
                                    <p className="text-sm text-muted-foreground">{participants.length} peserta telah mendaftar</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {participants.map((participant, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center shrink-0">
                                            <span className="text-sm font-bold text-red-600">
                                                {participant.name ? participant.name.charAt(0).toUpperCase() : "?"}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">
                                                {maskName(participant.name)}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {maskPhone(participant.phone)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Winners Gallery */}
                    {programWinners.length > 0 && (
                        <div className="mt-16">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                                    <Trophy className="h-5 w-5 text-white" />
                                </div>
                                <h2 className="text-2xl font-extrabold text-foreground">
                                    Galeri Pemenang
                                </h2>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                                {programWinners.map((winner) => (
                                    <Card
                                        key={winner.id}
                                        className="overflow-hidden cursor-pointer group border-0 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                                        onClick={() => setSelectedWinner(winner.id)}
                                    >
                                        <div className="aspect-square bg-gradient-to-br from-red-50 to-orange-50 relative overflow-hidden">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                    <Trophy className="h-8 w-8 text-primary/50" />
                                                </div>
                                            </div>
                                        </div>
                                        <CardContent className="p-3">
                                            <p className="text-xs font-semibold text-foreground truncate">
                                                {winner.name}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground truncate">
                                                {winner.week}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Winner Lightbox */}
                            <Dialog
                                open={!!selectedWinner}
                                onOpenChange={() => setSelectedWinner(null)}
                            >
                                <DialogContent className="sm:max-w-md">
                                    <DialogTitle className="sr-only">Detail Pemenang</DialogTitle>
                                    {selectedWinner && (() => {
                                        const winner = programWinners.find(
                                            (w) => w.id === selectedWinner
                                        );
                                        if (!winner) return null;
                                        return (
                                            <div className="text-center py-4">
                                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
                                                    <Trophy className="h-12 w-12 text-primary" />
                                                </div>
                                                <h3 className="text-xl font-bold text-foreground mb-1">
                                                    {winner.name}
                                                </h3>
                                                <p className="text-sm text-muted-foreground mb-1">
                                                    {winner.phone}
                                                </p>
                                                <p className="text-sm text-muted-foreground mb-1">
                                                    {winner.outlet}
                                                </p>
                                                <Badge variant="success" className="mt-2 btn-pill">
                                                    {winner.week}
                                                </Badge>
                                            </div>
                                        );
                                    })()}
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
