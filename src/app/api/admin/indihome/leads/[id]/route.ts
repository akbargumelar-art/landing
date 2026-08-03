import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { indihomeLeads } from "@/db/schema";
import { isIndihomeLeadStatus } from "@/lib/indihome-admin";
import { requireRole } from "@/lib/admin-auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = String(body.status || "");
    if (!isIndihomeLeadStatus(status)) {
        return NextResponse.json({ error: "Status pengajuan tidak valid." }, { status: 400 });
    }

    try {
        await db.update(indihomeLeads).set({ status }).where(eq(indihomeLeads.id, id));
        const [lead] = await db.select().from(indihomeLeads).where(eq(indihomeLeads.id, id));
        if (!lead) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
        return NextResponse.json({ lead });
    } catch (error) {
        console.error("Indihome lead PATCH error:", error);
        return NextResponse.json({ error: "Status gagal diperbarui." }, { status: 500 });
    }
}
