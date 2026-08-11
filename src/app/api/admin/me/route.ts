import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminActorScope } from "@/lib/admin-scope";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getAdminSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /**
     * Scope ikut dikirim supaya halaman bisa menamai cakupannya sendiri ("Outlet binaan saya"
     * / "Outlet TAP saya") dan memperingatkan assignment yang belum lengkap. Ini murni untuk
     * penjelasan di layar -- pembatasan sesungguhnya tetap terjadi di query server.
     */
    const scope = await getAdminActorScope();

    return NextResponse.json({
        session,
        scope: scope ? { role: scope.role, taps: scope.taps, hasSalesforce: Boolean(scope.salesforceId) } : null,
    });
}
