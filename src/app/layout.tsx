import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BackToTop } from "@/components/back-to-top";
import { DynamicFavicon } from "@/components/dynamic-favicon";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "ABK Ciraya - Telkomsel Authorized Partner",
    description:
        "PT Agrabudi Komunika - Mitra resmi Telkomsel di wilayah Cirebon dan Kuningan. Portal promo, program mitra outlet, dan layanan telekomunikasi terbaik.",
    keywords: [
        "Telkomsel",
        "ABK Ciraya",
        "PT Agrabudi Komunika",
        "Authorized Partner",
        "Cirebon",
        "Kuningan",
        "Paket Data",
        "Promo Telkomsel",
    ],
    authors: [{ name: "PT Agrabudi Komunika" }],
    openGraph: {
        title: "ABK Ciraya - Telkomsel Authorized Partner",
        description:
            "Mitra resmi Telkomsel di Cirebon & Kuningan. Promo menarik dan layanan terbaik.",
        type: "website",
        locale: "id_ID",
        url: "https://abkciraya.cloud",
        siteName: "ABK Ciraya",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="id">
            <head>
                <DynamicFavicon />
            </head>
            {/* Dipasang di layout root supaya berlaku untuk seluruh halaman -- publik,
                admin, maupun profil outlet -- tanpa perlu diulang di tiap layout. */}
            <body className={`min-h-screen ${inter.className}`}>
                {children}
                <BackToTop />
            </body>
        </html>
    );
}
