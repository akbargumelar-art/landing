import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mitraOutlets } from "@/db/schema";
import { getEditableOutlet, writeOutletEditLog } from "@/lib/mitra-outlet-edit";
import { findPhotoSlot } from "@/lib/mitra-outlet-photos";
import { MITRA_DETAIL_SESSION_COOKIE, getClientIp } from "@/lib/mitra-utils";
import { saveUploadedImage } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const sessionToken = request.cookies.get(MITRA_DETAIL_SESSION_COOKIE)?.value;
    const akses = await getEditableOutlet(publicToken, sessionToken);

    if (!akses) {
        return NextResponse.json({ error: "Verifikasi OTP diperlukan untuk mengubah foto outlet" }, { status: 401 });
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
        return NextResponse.json({ error: "Data unggahan tidak terbaca" }, { status: 400 });
    }

    // Slot dicocokkan ke daftar tetap, tidak dipakai langsung sebagai nama kolom --
    // nilai kiriman tidak boleh menentukan kolom mana yang ditulis.
    const slot = findPhotoSlot(formData.get("slot") || "depan");
    if (!slot) {
        return NextResponse.json({ error: "Jenis foto tidak dikenal" }, { status: 400 });
    }

    // Batas 5 MB dan tanpa SVG: unggahan ini terbuka untuk siapa pun yang lolos OTP,
    // jauh lebih luas daripada jalur admin.
    const hasil = await saveUploadedImage(formData.get("file") as File | null, {
        maxBytes: 5 * 1024 * 1024,
        publicUpload: true,
    });

    if (!hasil.ok) {
        return NextResponse.json({ error: hasil.error }, { status: hasil.status || 400 });
    }

    const sekarang = new Date();
    const sebelum = akses.outlet[slot.urlColumn];

    await db
        .update(mitraOutlets)
        .set({ [slot.urlColumn]: hasil.url, [slot.atColumn]: sekarang })
        .where(eq(mitraOutlets.id, akses.outlet.id));

    await writeOutletEditLog({
        outletId: akses.outlet.id,
        actorType: "MITRA",
        actorPhone: akses.session.phoneE164,
        action: "PHOTO",
        before: { slot: slot.key, url: sebelum },
        after: { slot: slot.key, label: slot.label, url: hasil.url },
        ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, slot: slot.key, url: hasil.url, updatedAt: sekarang });
}
