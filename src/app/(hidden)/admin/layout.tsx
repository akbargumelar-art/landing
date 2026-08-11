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

    const handleLogout = async () => {
        const { signOut } = await import("@/lib/auth-client");
        await signOut();
        router.push("/portal-admin");
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
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
                className={`fixed lg:sticky inset-y-0 left-0 lg:top-0 lg:h-screen z-50 bg-white border-r border-border flex flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-64"
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
                        className="lg:hidden w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground cursor-pointer"
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
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Topbar */}
                <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="lg:hidden w-10 h-10 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground cursor-pointer"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <LayoutDashboard className="h-5 w-5 text-red-600" />
                            <h1 className="text-sm font-semibold text-foreground">
                                {currentPage?.label || "Dashboard Admin"}
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                            <span className="text-xs font-semibold text-red-600">AD</span>
                        </div>
                        <span className="text-sm font-medium text-foreground hidden sm:block">
                            Admin
                        </span>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
