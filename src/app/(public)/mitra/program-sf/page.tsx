import Link from "next/link";
import { ArrowRight, Gift, Trophy } from "lucide-react";

import { getPublicPrograms } from "@/lib/mitra-programs";

export const dynamic = "force-dynamic";

function formatTanggal(value: Date | string | null) {
    if (!value) return "";
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export default async function ProgramSalesforceListPage() {
    const programs = await getPublicPrograms("SALESFORCE");

    return (
        <main className="min-h-screen bg-gray-50">
            <section className="bg-gradient-to-br from-red-700 via-red-600 to-orange-500">
                <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-extrabold text-white md:text-4xl">Program Salesforce</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
                        Papan pencapaian dan hadiah untuk tim salesforce. Pilih program untuk melihat
                        mekanisme, posisi sementara, dan tabel pencapaiannya.
                    </p>
                </div>
            </section>

            <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
                {programs.length === 0 ? (
                    <p className="rounded-lg border border-dashed bg-white px-6 py-16 text-center text-sm text-muted-foreground">
                        Belum ada program salesforce yang dipublikasikan.
                    </p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {programs.map((program) => (
                            <Link
                                key={program.id}
                                href={`/mitra/program-sf/${program.slug}`}
                                className="group rounded-lg border bg-white p-5 shadow-sm transition hover:border-red-200 hover:shadow-md"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                                        {program.mechanismType === "RACING" ? <Trophy className="h-3.5 w-3.5" /> : <Gift className="h-3.5 w-3.5" />}
                                        {program.mechanismType === "RACING" ? "Racing" : "Reward"}
                                    </span>
                                    <span className="text-xs font-semibold uppercase text-muted-foreground">{program.status}</span>
                                </div>
                                <h2 className="mt-3 font-bold text-gray-950 group-hover:text-red-600">{program.name}</h2>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {formatTanggal(program.periodStart)} – {formatTanggal(program.periodEnd)}
                                </p>
                                {program.descriptionMd && (
                                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{program.descriptionMd}</p>
                                )}
                                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-red-600">
                                    Lihat pencapaian <ArrowRight className="h-3.5 w-3.5" />
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}
