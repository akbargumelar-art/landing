import { NextResponse } from "next/server";

import { requireRole } from "@/lib/admin-auth";
import { renderTemplate, sendWhatsAppMessage, testWahaConnection } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Diagnosa koneksi WAHA untuk tombol "Tes Koneksi" di Pengaturan.
 *
 * Menggantikan /api/test-waha lama yang dihapus karena terbuka tanpa autentikasi dan bisa
 * dipakai siapa saja untuk mengirim WhatsApp ke nomor mana pun lewat gateway perusahaan.
 * Di sini nomor tujuan hanya boleh diisi Admin Super, dan pengirimannya opsional.
 */
export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const phone = String(body.phone || "").trim();

    const diagnostics = await testWahaConnection();

    // Tanpa nomor tujuan, cukup laporkan status koneksi tanpa mengirim apa pun.
    if (!phone) {
        return NextResponse.json({ diagnostics, sent: null });
    }

    if (!/^[0-9+\-\s()]{8,20}$/.test(phone)) {
        return NextResponse.json({ diagnostics, sent: { ok: false, error: "Format nomor tidak valid." } });
    }

    if (!diagnostics.configured) {
        return NextResponse.json({
            diagnostics,
            sent: { ok: false, error: "Isi dan simpan endpoint WAHA lebih dulu." },
        });
    }

    const message = renderTemplate(
        "Tes koneksi WhatsApp dari {app}. Jika pesan ini masuk, gateway sudah berfungsi.",
        { app: "Portal ABK Ciraya" },
    );
    const sent = await sendWhatsAppMessage(phone, message);

    return NextResponse.json({ diagnostics, sent });
}
