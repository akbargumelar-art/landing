import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { indihomeLeads } from "@/db/schema";
import { isIndihomeLeadStatus } from "@/lib/indihome-admin";
import { requireMitraAccess } from "@/lib/mitra-auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireMitraAccess(["MANAGER", "ADMIN"]);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = String(body.status || "");
    if (!isIndihomeLeadStatus(status)) {
        return NextResponse.json({ error: "Status pengajuan tidak valid." }, { status: 400 });
    }

    await db.update(indihomeLeads).set({ status }).where(eq(indihomeLeads.id, id));
    const [lead] = await db.select().from(indihomeLeads).where(eq(indihomeLeads.id, id));
    if (!lead) return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ lead });
}
