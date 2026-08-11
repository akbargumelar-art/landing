"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Settings,
    Image,
    FileText,
    FormInput,
    Users,
    Shuffle,
    LogOut,
    Menu,
    X,
    ChevronLeft,
    UserCircle,
    ShoppingCart,
    Ticket,
    Inbox,
    Lock,
    Calculator,
    ClipboardList,
    Store,
    BadgeCheck,
    Gift,
    Route,
    Wifi,
    UserCog,
    Trophy,
} from "lucide-react";

type AdminRole = "SUPER_ADMIN" | "ADMIN_INPUT" | "MANAGER" | "SUPERVISOR" | "SALESFORCE";

/**
 * Role kantor: mengelola data lintas wilayah dan konfigurasi sistem.
 *
 * Role lapangan (Supervisor dan Salesforce) sengaja tidak masuk daftar ini. Keduanya login
 * untuk memelihara outlet binaannya, bukan untuk membuka seluruh dashboard -- menu yang
 * muncul hanya karena seseorang berhasil masuk adalah cara paling mudah orang tersesat ke
 * layar yang API-nya akan menolaknya.
 */
const ROLE_KANTOR: AdminRole[] = ["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER"];

const sidebarGroups = [
    {
        // Seluruh grup ini khusus Admin Super: berisi konfigurasi sistem, gateway WhatsApp,
        // whitelist OTP, dan pengelolaan akun.
        title: "Sistem & Konten",
        links: [
            { href: "/admin/beranda", label: "Kelola Beranda", icon: Image, roles: ["SUPER_ADMIN"] as AdminRole[] },
            { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings, roles: ["SUPER_ADMIN"] as AdminRole[] },
            { href: "/admin/users", label: "Kelola User", icon: UserCog, roles: ["SUPER_ADMIN"] as AdminRole[] },
            { href: "/admin/mitra/audit", label: "Audit Log", icon: ClipboardList, roles: ["SUPER_ADMIN"] as AdminRole[] },
        ]
    },
    {
        title: "Layanan & Portal",
        links: [
            { href: "/admin/mitra/salesforce", label: "Database Salesforce", icon: BadgeCheck, roles: ROLE_KANTOR },
            { href: "/admin/mitra/outlet", label: "Database Outlet", icon: Store },
            { href: "/admin/mitra/monitoring", label: "Monitoring Visit", icon: Route },
            { href: "/admin/mitra/program", label: "Program Outlet", icon: Trophy, roles: ROLE_KANTOR },
            { href: "/admin/mitra/program-salesforce", label: "Program Salesforce", icon: Gift },
            { href: "/admin/indihome", label: "IndiHome", icon: Wifi, roles: ROLE_KANTOR },
            { href: "/admin/cuan", label: "Kalkulator Cuan", icon: Calculator, roles: ROLE_KANTOR },
        ]
    },
    {
        title: "E-Commerce",
        links: [
            { href: "/admin/belanja/produk", label: "Produk Belanja", icon: ShoppingCart, roles: ROLE_KANTOR },
            { href: "/admin/belanja/voucher", label: "Stok Voucher", icon: Ticket, roles: ROLE_KANTOR },
            { href: "/admin/belanja/pesanan", label: "Pesanan Masuk", icon: Inbox, roles: ROLE_KANTOR },
        ]
    },
    {
        // Khusus program pelanggan. Program mitra outlet dan salesforce ada di grup
        // Layanan & Portal bersama data yang dinilainya.
        title: "Event & Form",
        links: [
            { href: "/admin/program", label: "Program Undian", icon: FileText, roles: ROLE_KANTOR },
            { href: "/admin/form-builder", label: "Form Pengajuan", icon: FormInput, roles: ROLE_KANTOR },
            { href: "/admin/peserta", label: "Data Peserta", icon: Users, roles: ROLE_KANTOR },
            { href: "/admin/undi", label: "Undi Pemenang", icon: Shuffle, roles: ROLE_KANTOR },
        ]
    },
    {
        title: "Akun",
        links: [
            { href: "/admin/profil", label: "Profil Admin", icon: UserCircle },
        ]
    }
];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [role, setRole] = useState<AdminRole | null>(null);

    useEffect(() => {
        fetch("/api/admin/me")
            .then((res) => res.ok ? res.json() : null)
            .then((data) => setRole(data?.session?.role || null))
            .catch(() => setRole(null));
    }, []);

    const visibleGroups = sidebarGroups.map((group) => ({
        ...group,
        links: group.links.filter((link) => !("roles" in link) || (role !== null && (link.roles as AdminRole[]).includes(role))),
    })).filter((group) => group.links.length > 0);

    // Match the most specific href: /admin/mitra/program must not resolve to /admin/mitra.
    const activeHref = visibleGroups
        .flatMap((g) => g.links)
        .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href;

    const currentPage = visibleGroups.flatMap((g) => g.links).find((l) => l.href === activeHref);

    /**
     * Empat tujuan yang paling sering dipakai diletakkan di jangkauan ibu jari pada ponsel.
     * Daftarnya tetap diambil dari menu yang sudah lolos filter role di atas, jadi navigasi
     * bawah tidak dapat memperkenalkan tautan baru yang tidak tersedia di sidebar.
     */
    const mobilePrimaryHrefs = role === "SUPER_ADMIN"
        ? ["/admin/beranda", "/admin/mitra/outlet", "/admin/mitra/monitoring", "/admin/profil"]
        : ["/admin/mitra/outlet", "/admin/mitra/monitoring", "/admin/mitra/program-salesforce", "/admin/profil"];
    const visibleLinks = visibleGroups.flatMap((group) => group.links);
    const mobilePrimaryLinks = mobilePrimaryHrefs
        .map((href) => visibleLinks.find((link) => link.href === href))
        .filter((link): link is NonNullable<typeof link> => Boolean(link));

    /**
     * Menyembunyikan menu tidak menutup halamannya: alamatnya tetap bisa diketik, dan yang
     * muncul adalah layar penuh kontrol yang setiap aksinya akan ditolak API. Halaman yang
     * tidak boleh dibuka peran ini karena itu diganti pemberitahuan.
     *
     * Daftar izinnya dibaca dari `sidebarGroups` yang sama dengan sumber menu, sehingga
     * menambah halaman baru cukup dilakukan di satu tempat -- tidak ada daftar kedua yang
     * bisa tertinggal dan diam-diam membuka kembali halaman yang sudah ditutup.
     */
    const semuaTautan = sidebarGroups.flatMap((group) => group.links);
    const tautanCocok = semuaTautan
        .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0];

    const halamanDitutup = Boolean(
        role
        && tautanCocok
        && "roles" in tautanCocok
        && !(tautanCocok.roles as AdminRole[]).includes(role)
    );

    const handleLogout = async () => {
        const { signOut } = await import("@/lib/auth-client");
        await signOut();
        router.push("/portal-admin");
    };

    return (
        <div className="admin-app-shell flex min-h-screen bg-gray-50">
            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                /**
                 * Di layar lebar sidebar dibuat sticky setinggi layar, bukan static.
                 * Sebagai elemen static tingginya hanya setinggi isinya, sehingga pada
                 * halaman panjang menu ikut tergulir ke atas dan hilang dari pandangan.
                 * Daftar menunya sendiri sudah punya overflow-y-auto, jadi menu yang
                 * panjang tetap bisa digulir di dalam sidebar.
                 */
                className={`fixed inset-y-0 left-0 z-50 flex w-[min(88vw,20rem)] flex-col border-r border-border bg-white shadow-2xl transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:shadow-none ${collapsed ? "lg:w-16" : "lg:w-64"
                    } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
            >
                {/* Sidebar Header */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-border">
                    {!collapsed && (
                        <Link href="/admin/beranda" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">A</span>
                            </div>
                            <span className="text-sm font-bold text-foreground">
                                Admin Panel
                            </span>
                        </Link>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden lg:flex w-8 h-8 rounded-lg hover:bg-muted items-center justify-center text-muted-foreground cursor-pointer"
                    >
                        <ChevronLeft
                            className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
                        />
                    </button>
                    <button
                        onClick={() => setMobileOpen(false)}
                        aria-label="Tutup menu dashboard"
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-muted lg:hidden"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
                    {visibleGroups.map((group, i) => (
                        <div key={i} className="space-y-1">
                            {!collapsed && (
                                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-2">
                                    {group.title}
                                </p>
                            )}
                            {group.links.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${link.href === activeHref
                                        ? "bg-red-50 text-red-600"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        }`}
                                    title={collapsed ? link.label : undefined}
                                >
                                    <link.icon className="h-5 w-5 shrink-0" />
                                    {!collapsed && <span>{link.label}</span>}
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Logout */}
                <div className="p-2 border-t border-border">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 w-full cursor-pointer"
                        title={collapsed ? "Logout" : undefined}
                    >
                        <LogOut className="h-5 w-5 shrink-0" />
                        {!collapsed && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex min-h-screen min-w-0 flex-1 flex-col">
                {/* Topbar */}
                <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/80 bg-white/95 px-3 backdrop-blur-md sm:h-16 sm:px-4 lg:px-6">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <button
                            onClick={() => setMobileOpen(true)}
                            aria-label="Buka menu dashboard"
                            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-muted lg:hidden"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="flex min-w-0 items-center gap-2">
                            <LayoutDashboard className="hidden h-5 w-5 shrink-0 text-red-600 min-[390px]:block" />
                            <h1 className="truncate text-sm font-semibold text-foreground">
                                {currentPage?.label || "Dashboard Admin"}
                            </h1>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-100">
                            <span className="text-xs font-semibold text-red-600">AD</span>
                        </div>
                        <span className="text-sm font-medium text-foreground hidden sm:block">
                            Admin
                        </span>
                    </div>
                </header>

                {/* Page Content */}
                <main className="min-w-0 flex-1 overflow-x-hidden p-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:p-4 md:pb-4 lg:p-6">
                    {halamanDitutup ? (
                        <div className="mx-auto max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
                            <Lock className="mx-auto h-10 w-10 text-red-600" />
                            <h1 className="mt-4 text-lg font-bold">Halaman Ini Tidak Terbuka untuk Peran Anda</h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Akun Anda dapat mengelola data outlet binaan dan mengunggah fotonya. Menu lain
                                hanya bisa dibuka oleh admin kantor.
                            </p>
                            <Link href="/admin/mitra/outlet" className="mt-5 inline-block">
                                <span className="inline-flex h-10 items-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700">
                                    Buka Database Outlet
                                </span>
                            </Link>
                        </div>
                    ) : children}
                </main>
            </div>

            {/* Navigasi utama ala aplikasi. Tablet/desktop tetap memakai sidebar. */}
            <nav
                aria-label="Navigasi dashboard mobile"
                className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 backdrop-blur-md md:hidden"
            >
                <ul className="mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom)]">
                    {mobilePrimaryLinks.map((link) => {
                        const active = link.href === activeHref;
                        const label = link.label
                            .replace("Database ", "")
                            .replace("Monitoring Visit", "Monitor")
                            .replace("Program Salesforce", "Program")
                            .replace("Profil Admin", "Profil")
                            .replace("Kelola Beranda", "Beranda");

                        return (
                            <li key={link.href} className="min-w-0 flex-1">
                                <Link
                                    href={link.href}
                                    aria-current={active ? "page" : undefined}
                                    className={`flex h-16 flex-col items-center justify-center gap-1 px-1 transition-colors active:bg-gray-50 ${active ? "text-red-600" : "text-gray-500"}`}
                                >
                                    <link.icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                                    <span className="max-w-full truncate text-[10px] font-semibold leading-none">{label}</span>
                                </Link>
                            </li>
                        );
                    })}
                    <li className="min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            aria-label="Buka semua menu dashboard"
                            aria-expanded={mobileOpen}
                            className="flex h-16 w-full flex-col items-center justify-center gap-1 px-1 text-gray-500 transition-colors active:bg-gray-50"
                        >
                            <Menu className="h-5 w-5" />
                            <span className="text-[10px] font-semibold leading-none">Menu</span>
                        </button>
                    </li>
                </ul>
            </nav>
        </div>
    );
}
