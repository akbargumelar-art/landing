/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
    ChevronDown,
    ChevronUp,
    Gift,
    ListOrdered,
    Trophy,
    Users,
    Phone,
    MapPin,
} from "lucide-react";

interface Program {
    id: string;
    title: string;
    slug: string;
    period: string;
    content: string;
    terms: string[] | string;
    mechanics: string[] | string;
    prizes?: { title: string; imageUrl: string }[] | string;
    form?: { id: string } | null;
}

interface Winner {
    id: string;
    name: string;
    phone?: string;
    outlet?: string;
    period: string;
    photoUrl?: string;
    programId: string;
}

interface WinnerGroup {
    period: string;
    winners: Winner[];
}

interface Participant {
    id: string;
    participantName: string;
    participantPhone: string;
}

interface ParticipantGroup {
    period: string;
    participants: Participant[];
}
// Helper string masking
function maskData(text: string, type: 'name' | 'phone'): string {
    if (!text || text === "-") return type === 'name' ? "Peserta Anonim" : "-";

    // Do not mask default participant ID format (Peserta #ABCDEF)
    if (text.startsWith("Peserta #")) {
        return text;
    }

    if (type === 'name') {
        const words = text.split(" ");
        return words.map(word => {
            if (word.length <= 2) return word + "***";
            return word.substring(0, 2) + "***";
        }).join(" ");
    } else {
        if (text.length <= 7) return text.substring(0, 4) + "***";
        return text.substring(0, 4) + "*****" + text.substring(text.length - 3);
    }
}

export default function ProgramDetailPage() {
    const params = useParams();
    const slug = params.slug as string;

    const [program, setProgram] = useState<Program | null>(null);
    const [winnerGroups, setWinnerGroups] = useState<WinnerGroup[]>([]);
    const [participantGroups, setParticipantGroups] = useState<ParticipantGroup[]>([]);
    const [selectedWinner, setSelectedWinner] = useState<Winner | null>(null);
    const [activePeriodParticipants, setActivePeriodParticipants] = useState(0);
    const [activePeriodWinners, setActivePeriodWinners] = useState(0);
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
                    } catch { /* ignore */ }
                    setProgram(foundProg);

                    // Filter winners to this program
                    if (Array.isArray(winnersData)) {
                        const filtered = (winnersData as WinnerGroup[]).filter(group =>
                            group.winners.some(w => w.programId === foundProg.id)
                        ).map(group => ({
                            ...group,
                            winners: group.winners.filter(w => w.programId === foundProg.id),
                        }));
                        setWinnerGroups(filtered);
                    }
                }
            }
            if (Array.isArray(participantsData)) {
                setParticipantGroups(participantsData);
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

    const totalParticipants = participantGroups.reduce((sum, g) => sum + g.participants.length, 0);
    const totalWinners = winnerGroups.reduce((sum, g) => sum + g.winners.length, 0);

    return (
        <div className="min-h-screen">
            {/* Header */}
            <section className="h-[520px] md:h-[620px] bg-gradient-to-br from-red-600 via-red-500 to-orange-500 relative overflow-hidden flex items-center">
                <div className="absolute inset-0">
                    <div className="absolute top-10 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute top-20 left-1/4 w-16 h-16 border-2 border-white/10 rounded-2xl rotate-12 animate-float" />
                </div>
                <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
                    <Link href="/program" className="inline-flex items-center text-white/80 hover:text-white text-sm mb-6 transition-colors font-medium">
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
                <div className="wave-divider">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C59.71,118.11,130.83,141.14,321.39,56.44Z" fill="#ffffff" />
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
                                <h2 className="text-xl font-bold text-foreground mb-4">Tentang Program</h2>
                                <p className="text-muted-foreground leading-relaxed">{program.content}</p>
                            </div>

                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <ListOrdered className="h-4 w-4 text-primary" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground">Cara Mengikuti</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {(program.mechanics as string[]).map((step, index) => (
                                            <div key={index} className="flex items-start gap-3">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shrink-0 mt-0.5">
                                                    <span className="text-xs font-bold text-white">{index + 1}</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{step}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Hadiah Section */}
                            {(() => {
                                let prizes: { title: string; imageUrl: string }[] = [];
                                try {
                                    prizes = typeof program.prizes === "string" ? JSON.parse(program.prizes || "[]") : (program.prizes || []);
                                } catch { /* ignore */ }
                                if (prizes.length === 0) return null;
                                return (
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                                                <Gift className="h-4 w-4 text-white" />
                                            </div>
                                            <h3 className="text-lg font-bold text-foreground">Hadiah</h3>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            {prizes.map((prize, i) => (
                                                <div key={i} className="group rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                                                    {prize.imageUrl ? (
                                                        <div className="relative w-full h-36 bg-gradient-to-br from-gray-50 to-gray-100">
                                                            <Image src={prize.imageUrl} alt={prize.title} fill className="object-contain p-3 group-hover:scale-105 transition-transform duration-300" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-36 bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center">
                                                            <Gift className="h-12 w-12 text-orange-300" />
                                                        </div>
                                                    )}
                                                    {prize.title && (
                                                        <div className="px-3 py-2.5 text-center border-t">
                                                            <p className="text-sm font-semibold text-foreground">{prize.title}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <CheckCircle className="h-4 w-4 text-primary" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground">Syarat &amp; Ketentuan</h3>
                                    </div>
                                    <ul className="space-y-3">
                                        {(program.terms as string[]).map((term, index) => (
                                            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                                                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 mt-2 shrink-0" />
                                                {term}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            {/* ── CTA Daftar Card (Eye-Catching) ─── */}
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-6 shadow-xl shadow-red-200/50">
                                {/* Decorative background elements */}
                                <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full blur-sm" />
                                <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full blur-sm" />
                                <div className="absolute top-3 right-3 text-white/20 text-3xl animate-pulse">✦</div>
                                <div className="absolute bottom-8 left-3 text-white/15 text-xl animate-pulse" style={{ animationDelay: "0.5s" }}>✦</div>

                                <div className="relative z-10 text-center">
                                    {/* Icon + Badge */}
                                    <div className="flex items-center justify-center gap-2 mb-3">
                                        <span className="text-2xl">🎁</span>
                                        <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm btn-pill text-xs font-bold tracking-wide">
                                            🔥 PROGRAM AKTIF
                                        </Badge>
                                        <span className="text-2xl">🎁</span>
                                    </div>

                                    <h3 className="text-white font-extrabold text-lg mb-1">Ikuti Sekarang!</h3>
                                    <p className="text-white/80 text-sm mb-5">Jangan lewatkan kesempatan memenangkan hadiah menarik</p>

                                    {/* Stats inside card */}
                                    {(totalParticipants > 0 || totalWinners > 0) && (
                                        <div className="flex justify-center gap-3 mb-5">
                                            {totalParticipants > 0 && (
                                                <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                                                    <p className="text-xl font-extrabold text-white">{totalParticipants}</p>
                                                    <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Peserta</p>
                                                </div>
                                            )}
                                            {totalWinners > 0 && (
                                                <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                                                    <p className="text-xl font-extrabold text-white">{totalWinners}</p>
                                                    <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Pemenang</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* CTA Button */}
                                    <Link href={program.form?.id ? `/form-undian?id=${program.form.id}` : "#"}>
                                        <button
                                            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all duration-300 cursor-pointer ${program.form?.id
                                                ? "bg-white text-red-600 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 hover:scale-[1.02] active:scale-[0.98]"
                                                : "bg-white/30 text-white/70 cursor-not-allowed"
                                                }`}
                                            disabled={!program.form?.id}
                                        >
                                            {program.form?.id ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    📝 Daftar Sekarang
                                                </span>
                                            ) : (
                                                "Form Belum Tersedia"
                                            )}
                                        </button>
                                    </Link>

                                    {program.form?.id && (
                                        <p className="text-white/50 text-[10px] mt-3 font-medium">Pendaftaran gratis • Data anda aman</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Daftar Peserta ───────────────────────────────── */}
                    {participantGroups.length > 0 && (
                        <div className="mt-16">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-extrabold text-foreground">Daftar Peserta</h2>
                                    <p className="text-sm text-muted-foreground">{totalParticipants} peserta telah mendaftar</p>
                                </div>
                            </div>

                            {/* Period Tabs */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                {participantGroups.map((group, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActivePeriodParticipants(i)}
                                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${activePeriodParticipants === i
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            }`}
                                    >
                                        {group.period}
                                        <span className="ml-2 text-xs opacity-75">({group.participants.length})</span>
                                    </button>
                                ))}
                            </div>

                            {/* Participant Grid */}
                            {participantGroups[activePeriodParticipants] && (
                                <ParticipantList
                                    participants={participantGroups[activePeriodParticipants].participants}
                                />
                            )}
                        </div>
                    )}

                    {/* ── Galeri Penyerahan Hadiah ─────────────────────── */}
                    {winnerGroups.length > 0 && (
                        <div className="mt-16">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                                    <Trophy className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-extrabold text-foreground">Galeri Penyerahan Hadiah</h2>
                                    <p className="text-sm text-muted-foreground">{totalWinners} pemenang telah menerima hadiah</p>
                                </div>
                            </div>

                            {/* Period Tabs */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                {winnerGroups.map((group, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActivePeriodWinners(i)}
                                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${activePeriodWinners === i
                                            ? "bg-red-600 text-white shadow-md"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            }`}
                                    >
                                        {group.period}
                                        <span className="ml-2 text-xs opacity-75">({group.winners.length})</span>
                                    </button>
                                ))}
                            </div>

                            {/* Winners Grid */}
                            {winnerGroups[activePeriodWinners] && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {winnerGroups[activePeriodWinners].winners.map((winner) => (
                                        <Card
                                            key={winner.id}
                                            className="overflow-hidden cursor-pointer group border-0 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                                            onClick={() => setSelectedWinner(winner)}
                                        >
                                            {/* Photo / Placeholder */}
                                            <div className="h-48 bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 relative overflow-hidden flex items-center justify-center">
                                                {winner.photoUrl ? (
                                                    <Image src={winner.photoUrl} alt={winner.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-100 to-orange-200 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                            <Trophy className="h-10 w-10 text-red-500" />
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">Klik untuk detail</span>
                                                    </div>
                                                )}
                                                <div className="absolute top-3 left-3">
                                                    <span className="px-2 py-1 rounded-full bg-red-600 text-white text-[10px] font-bold shadow">🏆 Pemenang</span>
                                                </div>
                                            </div>
                                            <CardContent className="p-4">
                                                <p className="font-bold text-foreground text-sm mb-1">{maskData(winner.name, 'name')}</p>
                                                {winner.outlet && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {winner.outlet}
                                                    </p>
                                                )}
                                                {winner.phone && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <Phone className="h-3 w-3" />
                                                        {maskData(winner.phone, 'phone')}
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* Winner Detail Dialog */}
            <Dialog open={!!selectedWinner} onOpenChange={() => setSelectedWinner(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogTitle className="sr-only">Detail Pemenang</DialogTitle>
                    {selectedWinner && (
                        <div className="text-center py-4">
                            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center mx-auto mb-4 overflow-hidden">
                                {selectedWinner.photoUrl ? (
                                    <Image src={selectedWinner.photoUrl} alt={selectedWinner.name} fill className="object-cover" />
                                ) : (
                                    <Trophy className="h-12 w-12 text-primary" />
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-1">{maskData(selectedWinner.name, 'name')}</h3>
                            {selectedWinner.phone && (
                                <p className="text-sm text-muted-foreground mb-1 flex items-center justify-center gap-1">
                                    <Phone className="h-3.5 w-3.5" /> {maskData(selectedWinner.phone, 'phone')}
                                </p>
                            )}
                            {selectedWinner.outlet && (
                                <p className="text-sm text-muted-foreground mb-3 flex items-center justify-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" /> {selectedWinner.outlet}
                                </p>
                            )}
                            <Badge className="btn-pill bg-gradient-to-r from-red-500 to-orange-500 text-white border-0">
                                {selectedWinner.period}
                            </Badge>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── Participant List with Expand/Collapse ──
const INITIAL_SHOW = 8;

function ParticipantList({ participants }: {
    participants: { id: string; participantName: string; participantPhone: string }[];
}) {
    const [expanded, setExpanded] = React.useState(false);
    const showAll = expanded || participants.length <= INITIAL_SHOW;
    const displayed = showAll ? participants : participants.slice(0, INITIAL_SHOW);
    const remaining = participants.length - INITIAL_SHOW;

    return (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayed.map((participant, index) => {
                    const maskedName = maskData(participant.participantName, 'name');
                    const maskedPhone = participant.participantPhone !== "-" ? maskData(participant.participantPhone, 'phone') : null;

                    return (
                        <div
                            key={index}
                            className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200"
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-blue-600">
                                    {participant.participantName ? participant.participantName.charAt(0).toUpperCase() : "P"}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{maskedName}</p>
                                {maskedPhone && <p className="text-xs text-muted-foreground truncate">{maskedPhone}</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
            {participants.length > INITIAL_SHOW && (
                <div className="flex justify-center mt-4">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                        {expanded ? (
                            <>Sembunyikan <ChevronUp className="h-4 w-4" /></>
                        ) : (
                            <>Tampilkan {remaining} peserta lainnya <ChevronDown className="h-4 w-4" /></>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
