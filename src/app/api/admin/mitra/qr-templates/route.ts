import { NextResponse } from "next/server";
import { asc, eq, ne } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraQrTemplates } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/mitra-utils";
import { sanitizeElements, sanitizeImages } from "@/lib/qr-template-store";
import { TEMPLATE_BAWAAN } from "@/lib/qr-template";

export const dynamic = "force-dynamic";

function bacaNilai(body: Record<string, unknown>, existing?: typeof mitraQrTemplates.$inferSelect) {
    const angka = (kunci: string, bawaan: number) => {
        const nilai = Number(body[kunci]);
        return Number.isFinite(nilai) ? nilai.toFixed(2) : String(bawaan);
    };

    return {
        name: String(body.name || existing?.name || "Template Baru").slice(0, 255),
        backgroundColor: String(body.backgroundColor || existing?.backgroundColor || "#ffffff").slice(0, 20),
        backgroundImageUrl: body.backgroundImageUrl === "" ? null : (body.backgroundImageUrl as string) ?? existing?.backgroundImageUrl ?? null,
        imagesJson: sanitizeImages(body.images ?? existing?.imagesJson),
        qrX: angka("qrX", Number(existing?.qrX ?? TEMPLATE_BAWAAN.qrX)),
        qrY: angka("qrY", Number(existing?.qrY ?? TEMPLATE_BAWAAN.qrY)),
        qrSize: angka("qrSize", Number(existing?.qrSize ?? TEMPLATE_BAWAAN.qrSize)),
        elementsJson: sanitizeElements(body.elements ?? existing?.elementsJson),
    };
}

/** Hanya satu template boleh menjadi default; sisanya dimatikan dalam transaksi yang sama. */
async function tetapkanDefault(id: string) {
    await db.update(mitraQrTemplates).set({ isDefault: false }).where(ne(mitraQrTemplates.id, id));
    await db.update(mitraQrTemplates).set({ isDefault: true }).where(eq(mitraQrTemplates.id, id));
}

export async function GET() {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT", "MANAGER", "SUPERVISOR", "SALESFORCE"]);
    if (auth.error) return auth.error;

    const templates = await db.select().from(mitraQrTemplates).orderBy(asc(mitraQrTemplates.name));
    return NextResponse.json({ templates, bawaan: TEMPLATE_BAWAAN });
}

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const id = uuid();
    const nilai = bacaNilai(body);

    const [pertama] = await db.select({ id: mitraQrTemplates.id }).from(mitraQrTemplates).limit(1);

    await db.insert(mitraQrTemplates).values({
        id,
        ...nilai,
        // Template pertama otomatis menjadi default, kalau tidak tidak ada yang terpakai.
        isDefault: body.isDefault === true || !pertama,
        createdAt: new Date(),
    });

    if (body.isDefault === true || !pertama) await tetapkanDefault(id);

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "CREATE",
        entity: "mitra_qr_template",
        entityId: id,
        diff: { name: nilai.name },
        ip: getClientIp(request),
    });

    const [dibuat] = await db.select().from(mitraQrTemplates).where(eq(mitraQrTemplates.id, id)).limit(1);
    return NextResponse.json(dibuat, { status: 201 });
}

export async function PUT(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    const [existing] = await db.select().from(mitraQrTemplates).where(eq(mitraQrTemplates.id, id)).limit(1);

    if (!existing) return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });

    await db.update(mitraQrTemplates).set(bacaNilai(body, existing)).where(eq(mitraQrTemplates.id, id));
    if (body.isDefault === true) await tetapkanDefault(id);

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "UPDATE",
        entity: "mitra_qr_template",
        entityId: id,
        diff: { name: body.name, isDefault: body.isDefault },
        ip: getClientIp(request),
    });

    const [diperbarui] = await db.select().from(mitraQrTemplates).where(eq(mitraQrTemplates.id, id)).limit(1);
    return NextResponse.json(diperbarui);
}

export async function DELETE(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const id = new URL(request.url).searchParams.get("id") || "";
    const [existing] = await db.select().from(mitraQrTemplates).where(eq(mitraQrTemplates.id, id)).limit(1);

    if (!existing) return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });

    await db.delete(mitraQrTemplates).where(eq(mitraQrTemplates.id, id));

    // Kalau yang dihapus adalah default, template tersisa pertama menggantikannya supaya
    // pencetakan tidak diam-diam kembali ke tata letak bawaan.
    if (existing.isDefault) {
        const [pengganti] = await db.select({ id: mitraQrTemplates.id }).from(mitraQrTemplates).limit(1);
        if (pengganti) await tetapkanDefault(pengganti.id);
    }

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "DELETE",
        entity: "mitra_qr_template",
        entityId: id,
        diff: { name: existing.name },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
}
