"use client";

import React, { useState } from "react";
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
} from "lucide-react";

const sidebarLinks = [
    { href: "/admin/pengaturan", label: "Pengaturan Website", icon: Settings },
    { href: "/admin/beranda", label: "Kelola Beranda", icon: Image },
    { href: "/admin/program", label: "Kelola Program", icon: FileText },
    { href: "/admin/belanja/produk", label: "Produk Belanja", icon: ShoppingCart },
    { href: "/admin/belanja/voucher", label: "Stok Voucher", icon: Ticket },
    { href: "/admin/belanja/pesanan", label: "Pesanan Masuk", icon: Inbox },
    { href: "/admin/form-builder", label: "Kelola Form", icon: FormInput },
    { href: "/admin/peserta", label: "Data Peserta", icon: Users },
    { href: "/admin/undi", label: "Undi Pemenang", icon: Shuffle },
    { href: "/admin/profil", label: "Profil Admin", icon: UserCircle },
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

    const currentPage = sidebarLinks.find((l) => pathname.startsWith(l.href));

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
                className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-border flex flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-64"
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
                <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                    {sidebarLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${pathname.startsWith(link.href)
                                ? "bg-red-50 text-red-600"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                            title={collapsed ? link.label : undefined}
                        >
                            <link.icon className="h-5 w-5 shrink-0" />
                            {!collapsed && <span>{link.label}</span>}
                        </Link>
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
