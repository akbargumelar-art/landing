import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // better-auth session cookies (handles both dev and prod secure cookies)
    const sessionCookie =
        request.cookies.get("better-auth.session_token")?.value ||
        request.cookies.get("__Secure-better-auth.session_token")?.value;

    // Redirect logged-in users away from login page.
    //
    // Tujuannya /admin/mitra, bukan /admin/beranda: middleware berjalan di edge tanpa akses
    // database sehingga tidak bisa mengetahui peran pengguna, sedangkan /admin/beranda
    // khusus Admin Super. Mengarahkan semua orang ke sana membuat peran lain mendarat di
    // halaman yang API-nya membalas 403.
    if (pathname === "/portal-admin") {
        if (sessionCookie) {
            return NextResponse.redirect(new URL("/admin/mitra", request.url));
        }
        return NextResponse.next();
    }

    // Protect admin routes (but not the login page)
    if (pathname.startsWith("/admin")) {
        if (!sessionCookie) {
            return NextResponse.redirect(new URL("/portal-admin", request.url));
        }
        return NextResponse.next();
    }

    // Protect admin API routes (basic middleware check, stricter checks happen inside the route handlers)
    if (pathname.startsWith("/api/admin")) {
        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/api/admin/:path*", "/portal-admin"],
};
