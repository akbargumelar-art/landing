import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // better-auth session cookies (handles both dev and prod secure cookies)
    const sessionCookie =
        request.cookies.get("better-auth.session_token")?.value ||
        request.cookies.get("__Secure-better-auth.session_token")?.value;

    // Redirect logged-in users away from login page
    if (pathname === "/portal-admin") {
        if (sessionCookie) {
            return NextResponse.redirect(new URL("/admin/beranda", request.url));
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
