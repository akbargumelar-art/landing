import { NextResponse } from "next/server";
import { and, desc, eq, like, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { indihomeLeads } from "@/db/schema";
import { isIndihomeLeadStatus } from "@/lib/indihome-admin";
import { requireRole } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER"]);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim().slice(0, 100);
    const status = searchParams.get("status") || "";
    const location = searchParams.get("location") || "";
    const filters: SQL[] = [];

    if (query) {
        const queryFilter = or(
            like(indihomeLeads.fullName, `%${query}%`),
            like(indihomeLeads.phoneE164, `%${query}%`),
            like(indihomeLeads.district, `%${query}%`),
        );
        if (queryFilter) filters.push(queryFilter);
    }
    if (isIndihomeLeadStatus(status)) filters.push(eq(indihomeLeads.status, status));
    // Filter on the stored value directly: locations are managed in the database now, and
    // a whitelist check would silently ignore filters for newly added or renamed areas.
    if (location) filters.push(eq(indihomeLeads.location, location.slice(0, 120)));

    try {
        const leads = await db
            .select()
            .from(indihomeLeads)
            .where(filters.length ? and(...filters) : undefined)
            .orderBy(desc(indihomeLeads.createdAt))
            .limit(250);

        return NextResponse.json({ leads });
    } catch (error) {
        console.error("Indihome leads GET error:", error);
        return NextResponse.json({ error: "Pengajuan gagal dimuat." }, { status: 500 });
    }
}
