import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "abk-ciraya-admin-secret-key-2026"
);

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Protect admin routes (but not the login page)
    if (pathname.startsWith("/admin")) {
        const token = request.cookies.get("abk_admin_token")?.value;

        if (!token) {
            return NextResponse.redirect(new URL("/portal-admin", request.url));
        }

        try {
            await jwtVerify(token, JWT_SECRET);
            return NextResponse.next();
        } catch {
            // Invalid token, redirect to login
            const response = NextResponse.redirect(new URL("/portal-admin", request.url));
            response.cookies.delete("abk_admin_token");
            return response;
        }
    }

    // Protect admin API routes
    if (pathname.startsWith("/api/admin")) {
        const token = request.cookies.get("abk_admin_token")?.value;

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
            await jwtVerify(token, JWT_SECRET);
            return NextResponse.next();
        } catch {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/api/admin/:path*"],
};
