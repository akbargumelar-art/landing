"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Shuffle, Trophy, PartyPopper, RotateCcw, Loader2, History, Upload, Trash2,
} from "lucide-react";
import Image from "next/image";

interface Program {
    id: string;
    title: string;
    prizes?: string;
}

interface Winner {
    id: string;
    name: string;
    drawnAt: string;
    photoUrl?: string;
    prizeName?: string;
    program: { id: string; title: string, prizes?: string };
}

export default function UndiPage() {
    const [programs, setPrograms] = useState<Program[]>([]);
    const [selectedProgram, setSelectedProgram] = useState("");
    const [winners, setWinners] = useState<Winner[]>([]);
    const [loading, setLoading] = useState(true);

    const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState("");
    const [availablePrizes, setAvailablePrizes] = useState<{ title: string }[]>([]);
    const [selectedPrize, setSelectedPrize] = useState("");

    const [uploadingWinnerId, setUploadingWinnerId] = useState<string | null>(null);

    // Lottery state
    const [isRolling, setIsRolling] = useState(false);
    const [rollingName, setRollingName] = useState("");
    const [winner, setWinner] = useState<string | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [error, setError] = useState("");
    const rollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        Promise.all([
            fetch("/api/admin/programs").then((r) => r.json()),
            fetch("/api/admin/lottery/winners").then((r) => r.json()),
        ]).then(([programsData, winnersData]) => {
            setPrograms(programsData);
            setWinners(winnersData);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        setAvailablePeriods([]);
        setSelectedPeriod("");
        setAvailablePrizes([]);
        setSelectedPrize("");
        if (selectedProgram) {
            const prog = programs.find(p => p.id === selectedProgram);
            if (prog && prog.prizes) {
                try {
                    setAvailablePrizes(JSON.parse(prog.prizes));
                } catch { setAvailablePrizes([]); }
            }

            fetch(`/api/admin/lottery/periods?programId=${selectedProgram}`)
                .then(r => r.json())
                .then(setAvailablePeriods)
                .catch(() => { });
        }
    }, [selectedProgram, programs]);

    const roll = useCallback(async () => {
        if (!selectedProgram) { setError("Pilih program terlebih dahulu"); return; }
        setError("");
        setWinner(null);
        setShowConfetti(false);
        setIsRolling(true);

        try {
            const res = await fetch("/api/admin/lottery/draw", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ programId: selectedProgram, period: selectedPeriod, prizeName: selectedPrize }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error);
                setIsRolling(false);
                return;
            }

            // Rolling animation with all eligible names
            const names = data.allNames || [];
            let count = 0;
            const maxRolls = 30;

            rollInterval.current = setInterval(() => {
                count++;
                const randomIdx = Math.floor(Math.random() * names.length);
                setRollingName(names[randomIdx] || "...");

                if (count >= maxRolls) {
                    if (rollInterval.current) clearInterval(rollInterval.current);
                    setRollingName(data.winner.name);
                    setWinner(data.winner.name);
                    setIsRolling(false);
                    setShowConfetti(true);

                    // Refresh winners list
                    fetch("/api/admin/lottery/winners").then((r) => r.json()).then(setWinners);

                    // Hide confetti after 5s
                    setTimeout(() => setShowConfetti(false), 5000);
                }
            }, 80);
        } catch {
            setError("Terjadi kesalahan");
            setIsRolling(false);
        }
    }, [selectedProgram, selectedPeriod]);

    const reset = () => {
        if (rollInterval.current) clearInterval(rollInterval.current);
        setIsRolling(false);
        setWinner(null);
        setRollingName("");
        setShowConfetti(false);
        setError("");
    };

    const handleUploadWinnerPhoto = async (e: React.ChangeEvent<HTMLInputElement>, winnerId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingWinnerId(winnerId);

        const fd = new FormData();
        fd.append("file", file);
        try {
            const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
            const uploadData = await uploadRes.json();

            if (uploadRes.ok && uploadData.url) {
                const updateRes = await fetch(`/api/admin/lottery/winners/${winnerId}/photo`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ photoUrl: uploadData.url })
                });

                if (updateRes.ok) {
                    setWinners(prev => prev.map(w => w.id === winnerId ? { ...w, photoUrl: uploadData.url } : w));
                } else {
                    alert("Gagal menyimpan foto ke database pemenang.");
                }
            } else {
                alert(`Gagal upload file: ${uploadData.error || "Error"}`);
            }
        } catch {
            alert("Terjadi kesalahan saat upload foto");
        }
        setUploadingWinnerId(null);
    };

    const deleteWinnerPhoto = async (winnerId: string) => {
        if (!confirm("Hapus foto pemenang ini?")) return;
        setUploadingWinnerId(winnerId); // Use same loading state to disable UI
        try {
            const updateRes = await fetch(`/api/admin/lottery/winners/${winnerId}/photo`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photoUrl: "" })
            });

            if (updateRes.ok) {
                setWinners(prev => prev.map(w => w.id === winnerId ? { ...w, photoUrl: "" } : w));
            } else {
                alert("Gagal menghapus foto dari database pemenang.");
            }
        } catch {
            alert("Terjadi kesalahan saat menghapus foto");
        }
        setUploadingWinnerId(null);
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    const programWinners = selectedProgram
        ? winners.filter((w) => w.program.id === selectedProgram)
        : winners;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Undi Pemenang</h2>

            {/* Program Selection */}
            <Card>
                <CardContent className="p-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Pilih Program</label>
                            <select
                                value={selectedProgram}
                                onChange={(e) => { setSelectedProgram(e.target.value); reset(); }}
                                className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                            >
                                <option value="">Pilih program untuk diundi...</option>
                                {programs.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
                            </select>
                        </div>
                        {selectedProgram && availablePeriods.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Pilih Periode (Opsional)</label>
                                <select
                                    value={selectedPeriod}
                                    onChange={(e) => { setSelectedPeriod(e.target.value); reset(); }}
                                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                                >
                                    <option value="">Semua Periode</option>
                                    {availablePeriods.map((p) => (<option key={p} value={p}>{p}</option>))}
                                </select>
                            </div>
                        )}
                        {selectedProgram && availablePrizes.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Pilih Hadiah (Opsional)</label>
                                <select
                                    value={selectedPrize}
                                    onChange={(e) => setSelectedPrize(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                                >
                                    <option value="">Tanpa Keterangan Hadiah</option>
                                    {availablePrizes.map((p, i) => (<option key={i} value={p.title}>{p.title}</option>))}
                                </select>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Lottery Machine */}
            <Card className="overflow-hidden">
                <div className="bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-8 relative">
                    {/* Confetti */}
                    {showConfetti && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute w-3 h-3 rounded-sm animate-bounce"
                                    style={{
                                        left: `${Math.random() * 100}%`,
                                        top: `${Math.random() * 100}%`,
                                        backgroundColor: ["#FFD700", "#FF6347", "#00CED1", "#FF69B4", "#98FB98"][i % 5],
                                        animationDelay: `${Math.random() * 2}s`,
                                        animationDuration: `${1 + Math.random() * 2}s`,
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    <div className="text-center relative z-10">
                        {/* Display */}
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-6 min-h-[120px] flex items-center justify-center">
                            {winner ? (
                                <div className="space-y-2">
                                    <PartyPopper className="h-10 w-10 text-yellow-300 mx-auto" />
                                    <p className="text-3xl md:text-4xl font-extrabold text-white">{winner}</p>
                                    <p className="text-white/70 text-sm">🎉 Selamat kepada pemenang! 🎉</p>
                                </div>
                            ) : isRolling ? (
                                <p className="text-3xl md:text-4xl font-extrabold text-white animate-pulse">{rollingName || "..."}</p>
                            ) : (
                                <div className="space-y-2">
                                    <Trophy className="h-10 w-10 text-white/40 mx-auto" />
                                    <p className="text-white/60 text-sm">Pilih program dan tekan tombol untuk mengundi</p>
                                </div>
                            )}
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 justify-center">
                            {winner ? (
                                <Button onClick={reset} size="lg" className="btn-pill bg-white text-red-600 hover:bg-gray-100 font-bold px-8 cursor-pointer">
                                    <RotateCcw className="mr-2 h-5 w-5" /> Undi Lagi
                                </Button>
                            ) : (
                                <Button
                                    onClick={roll}
                                    size="lg"
                                    disabled={isRolling || !selectedProgram}
                                    className="btn-pill bg-white text-red-600 hover:bg-gray-100 font-bold px-10 cursor-pointer disabled:opacity-50"
                                >
                                    {isRolling ? (
                                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Mengacak...</>
                                    ) : (
                                        <><Shuffle className="mr-2 h-5 w-5" /> Acak Pemenang</>
                                    )}
                                </Button>
                            )}
                        </div>

                        {error && <p className="text-white/90 text-sm mt-4 bg-white/10 rounded-lg py-2 px-4 inline-block">{error}</p>}
                    </div>
                </div>
            </Card>

            {/* Winner History */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <History className="h-5 w-5" /> Histori Pemenang
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {programWinners.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Belum ada pemenang</p>
                    ) : (
                        <div className="space-y-2">
                            {programWinners.map((w) => (
                                <div key={w.id} className="flex items-center gap-3 p-3 rounded-lg border bg-white">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shrink-0">
                                        <Trophy className="h-5 w-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm">{w.name}</p>
                                        <p className="text-xs text-muted-foreground">{w.program.title} {w.prizeName ? `- ${w.prizeName}` : ""}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs shrink-0">
                                            {new Date(w.drawnAt).toLocaleDateString("id-ID")}
                                        </Badge>

                                        {/* Per-Winner Photo Display / Upload */}
                                        <div className="shrink-0 flex gap-2 items-center border-l pl-3 ml-1">
                                            {w.photoUrl ? (
                                                <div className="relative group w-10 h-10 rounded overflow-hidden shadow-sm border">
                                                    <Image src={w.photoUrl} alt="Foto Pemenang" fill className="object-cover" unoptimized={true} />
                                                    <button
                                                        onClick={() => deleteWinnerPhoto(w.id)}
                                                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                        title="Hapus foto pemenang"
                                                        disabled={uploadingWinnerId === w.id}
                                                    >
                                                        {uploadingWinnerId === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className={`w-10 h-10 flex flex-col items-center justify-center bg-gray-50 border border-dashed rounded text-muted-foreground hover:bg-gray-100 transition-colors cursor-pointer ${uploadingWinnerId === w.id ? "opacity-50 pointer-events-none" : ""}`} title="Upload foto penyerahan hadiah">
                                                    {uploadingWinnerId === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadWinnerPhoto(e, w.id)} disabled={uploadingWinnerId === w.id} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
