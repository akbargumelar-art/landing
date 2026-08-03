import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { IndihomePlansAndForm } from "@/components/indihome/indihome-plans-and-form";
import { getActiveIndihomeBanner, getActiveIndihomeLocations } from "@/lib/indihome-data";

export const metadata: Metadata = {
    title: "IndiHome Cirebon dan Kuningan | Agrabudi Komunika",
    description: "Temukan paket internet rumah berdasarkan lokasi dan ajukan pemasangan IndiHome di Cirebon dan Kuningan.",
};

// Banner and coverage areas are managed from the admin, so this page must not be
// statically cached at build time.
export const dynamic = "force-dynamic";

function formatCoverage(locations: string[]) {
    if (locations.length === 0) return "Cirebon dan Kuningan";
    if (locations.length === 1) return locations[0];
    return `${locations.slice(0, -1).join(", ")} dan ${locations[locations.length - 1]}`;
}

export default async function IndihomePage() {
    const [banner, locations] = await Promise.all([
        getActiveIndihomeBanner(),
        getActiveIndihomeLocations(),
    ]);

    return (
        <div className="bg-white">
            <section className="relative isolate flex min-h-[510px] items-center overflow-hidden bg-gray-950 sm:min-h-[580px]">
                <Image
                    src={banner.imageUrl}
                    alt="Keluarga menikmati koneksi internet rumah di ruang keluarga"
                    fill
                    priority
                    sizes="100vw"
                    unoptimized
                    className="-z-20 object-cover object-[64%_center] sm:object-center"
                />
                <div className="absolute inset-0 -z-10 bg-black/20" />
                <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                    <div className="max-w-xl text-white">
                        <div className="flex items-center gap-2 text-sm font-bold uppercase">
                            <MapPin className="h-4 w-4 text-red-500" aria-hidden="true" />
                            {formatCoverage(locations)}
                        </div>
                        <h1 className="mt-5 text-5xl font-black leading-none sm:text-6xl">IndiHome</h1>
                        <p className="mt-5 max-w-lg text-xl font-bold leading-8 sm:text-2xl">
                            {banner.headline}
                        </p>
                        <p className="mt-4 max-w-lg text-base leading-7 text-white/85 sm:text-lg">
                            {banner.subheadline}
                        </p>
                        {banner.ctaText && (
                            <a
                                href={banner.ctaLink || "#paket"}
                                className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-red-600 px-6 text-sm font-bold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-950"
                            >
                                {banner.ctaText}
                                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                            </a>
                        )}
                    </div>
                </div>
            </section>

            <IndihomePlansAndForm />
        </div>
    );
}
