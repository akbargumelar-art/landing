import type { Metadata } from "next";
import "./globals.css";

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
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="min-h-screen">{children}</body>
        </html>
    );
}
