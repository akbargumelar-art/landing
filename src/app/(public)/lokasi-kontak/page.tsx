"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    MapPin,
    Phone,
    ExternalLink,
    MessageCircle,
    Instagram,
    Facebook,
    Loader2,
} from "lucide-react";

// Fallback defaults
const defaultOffices = [
    {
        city: "Kantor Pusat Cirebon",
        address: "Jl. Pemuda Raya No.21B, Sunyaragi, Kec. Kesambi, Kota Cirebon, Jawa Barat 45132",
        mapUrl: "https://www.google.com/maps/search/Jl.+Pemuda+Raya+No.21B+Sunyaragi+Kesambi+Kota+Cirebon",
        gradient: "from-red-500 via-red-600 to-orange-500",
    },
    {
        city: "Kantor Kuningan",
        address: "Jl. Siliwangi No.45, Purwawinangun, Kec. Kuningan, Kabupaten Kuningan, Jawa Barat 45512",
        mapUrl: "https://www.google.com/maps/search/Jl.+Siliwangi+No.45+Purwawinangun+Kuningan",
        gradient: "from-red-600 via-red-500 to-red-700",
    },
];

const defaultContacts = [
    {
        icon: MessageCircle,
        label: "WhatsApp",
        value: "+62 851-6882-2280",
        href: "https://wa.me/6285168822280",
        color: "bg-green-500",
    },
    {
        icon: Instagram,
        label: "Instagram",
        value: "@agrabudikomunika",
        href: "https://www.instagram.com/agrabudikomunika",
        color: "bg-gradient-to-br from-pink-500 to-orange-500",
    },
    {
        icon: Facebook,
        label: "Facebook",
        value: "ABK Ciraya",
        href: "https://tsel.id/fbciraya",
        color: "bg-blue-600",
    },
];

interface OfficeData {
    city: string;
    label: string;
    address: string;
    phone: string;
    mapUrl: string;
}

export default function LokasiKontakPage() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/public/settings")
            .then((r) => r.json())
            .then((data) => {
                setSettings(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Build contacts from settings with fallback
    const contacts = [
        {
            icon: MessageCircle,
            label: "WhatsApp",
            value: settings.whatsapp || defaultContacts[0].value,
            href: settings.whatsapp_url || defaultContacts[0].href,
            color: "bg-green-500",
        },
        {
            icon: Instagram,
            label: "Instagram",
            value: settings.instagram_handle || defaultContacts[1].value,
            href: settings.instagram_url || defaultContacts[1].href,
            color: "bg-gradient-to-br from-pink-500 to-orange-500",
        },
        {
            icon: Facebook,
            label: "Facebook",
            value: settings.facebook_name || defaultContacts[2].value,
            href: settings.facebook_url || defaultContacts[2].href,
            color: "bg-blue-600",
        },
    ];

    const whatsappCTA = settings.whatsapp_url || defaultContacts[0].href;

    // Parse office_data from settings, or use defaults
    let offices = defaultOffices;
    if (settings.office_data) {
        try {
            const parsed: OfficeData[] = JSON.parse(settings.office_data);
            if (parsed.length > 0) {
                offices = parsed.map((o, i) => ({
                    city: o.label || o.city || `Kantor ${i + 1}`,
                    address: o.address,
                    mapUrl: o.mapUrl,
                    gradient: i % 2 === 0 ? "from-red-500 via-red-600 to-orange-500" : "from-red-600 via-red-500 to-red-700",
                }));
            }
        } catch { /* use defaults */ }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <section className="h-[520px] md:h-[620px] bg-gradient-to-br from-red-600 via-red-500 to-orange-500 relative overflow-hidden flex items-center">
                <div className="absolute inset-0">
                    <div className="absolute top-10 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-10 left-10 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute top-16 left-1/4 w-14 h-14 border-2 border-white/10 rounded-2xl rotate-12 animate-float" />
                    <div className="absolute bottom-20 right-1/3 w-10 h-10 border-2 border-white/10 rounded-full animate-float-delayed" />
                </div>
                <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center w-full">
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4">
                        Lokasi & Kontak
                    </h1>
                    <p className="text-lg md:text-xl text-white/85 max-w-2xl mx-auto">
                        Temukan kantor kami atau hubungi melalui media sosial
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

            {/* Office Locations */}
            <section className="py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <span className="inline-block text-primary text-sm font-bold uppercase tracking-widest mb-3">
                            Lokasi Kantor
                        </span>
                        <h2 className="text-3xl font-extrabold text-foreground">
                            Kantor Kami
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {offices.map((office, index) => (
                            <Card
                                key={index}
                                className="overflow-hidden border-0 shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                            >
                                <div className={`h-44 bg-gradient-to-br ${office.gradient} relative overflow-hidden`}>
                                    <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
                                    <div className="absolute -bottom-2 -left-2 w-14 h-14 bg-white/10 rounded-full" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                                            <MapPin className="h-8 w-8 text-white" />
                                        </div>
                                    </div>
                                </div>
                                <CardContent className="p-6">
                                    <h3 className="font-bold text-foreground text-lg mb-2">
                                        {office.city}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                        {office.address}
                                    </p>
                                    <a href={office.mapUrl} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" className="btn-pill w-full font-semibold hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 cursor-pointer">
                                            <MapPin className="mr-2 h-4 w-4" />
                                            Lihat di Google Maps
                                            <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                        </Button>
                                    </a>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <Separator className="max-w-7xl mx-auto" />

            {/* Contact & Social */}
            <section className="py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <span className="inline-block text-primary text-sm font-bold uppercase tracking-widest mb-3">
                            Hubungi Kami
                        </span>
                        <h2 className="text-3xl font-extrabold text-foreground">
                            Kontak & Sosial Media
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
                        {contacts.map((contact, index) => (
                            <a
                                key={index}
                                href={contact.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                            >
                                <Card className="border-0 shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer">
                                    <CardContent className="p-6 text-center">
                                        <div className={`w-14 h-14 rounded-2xl ${contact.color} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                                            <contact.icon className="h-7 w-7 text-white" />
                                        </div>
                                        <h3 className="font-bold text-foreground mb-1">
                                            {contact.label}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {contact.value}
                                        </p>
                                    </CardContent>
                                </Card>
                            </a>
                        ))}
                    </div>

                    {/* WhatsApp CTA */}
                    <div className="mt-12 text-center">
                        <a href={whatsappCTA} target="_blank" rel="noopener noreferrer">
                            <Button
                                size="lg"
                                className="btn-pill bg-green-600 hover:bg-green-700 text-white shadow-xl text-base font-bold px-10 h-auto py-3 hover:shadow-2xl transition-all duration-300 cursor-pointer"
                            >
                                <Phone className="mr-2 h-5 w-5" />
                                Chat via WhatsApp
                            </Button>
                        </a>
                    </div>
                </div>
            </section>
        </div>
    );
}
