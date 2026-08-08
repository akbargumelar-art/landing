import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";

import { db } from "@/db";
import { mitraOutlets } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { buildOutletPublicUrl, getClientIp } from "@/lib/mitra-utils";
import { KARTU_LEBAR_MM, KARTU_TINGGI_MM, MM, gambarKartu, siapkanFont, type QrCardData, type QrTemplate } from "@/lib/qr-template";
import { ambilTemplateCetak } from "@/lib/qr-template-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const outletIds = Array.isArray(body.outletIds) ? body.outletIds.map(String) : [];
    const outlets = outletIds.length > 0
        ? await db.select().from(mitraOutlets).where(inArray(mitraOutlets.id, outletIds))
        : await db.select().from(mitraOutlets).limit(100);

    const template = await ambilTemplateCetak(body.templateId ? String(body.templateId) : null);
    const pdf = await buildBulkCardsPdf(
        outlets.map((outlet) => ({
            outletName: outlet.name,
            outletCode: outlet.outletCode,
            tap: outlet.tap,
            kabupaten: outlet.kabupaten,
            kecamatan: outlet.kecamatan,
            ownerName: outlet.ownerName,
            url: buildOutletPublicUrl(outlet.publicToken, request),
        })),
        template,
        new URL(request.url).origin
    );

    await writeAdminAuditLog({
        userId: auth.session?.userId,
        action: "EXPORT_QR",
        entity: "mitra_outlet",
        diff: { count: outlets.length },
        ip: getClientIp(request),
    });

    return new NextResponse(pdf, {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline; filename=\"mitra-qr-cards.pdf\"",
        },
    });
}

/**
 * Susunan 2 kolom x 5 baris per A4 dipertahankan; isi tiap kartunya kini digambar
 * gambarKartu() yang sama dengan kartu satuan, sehingga template yang dipilih berlaku
 * pada kedua jalur cetak tanpa ada dua tata letak yang harus dijaga selaras.
 */
async function buildBulkCardsPdf(cards: QrCardData[], template: QrTemplate, origin: string) {
    const a4Width = 210 * MM;
    const a4Height = 297 * MM;
    const cardWidth = KARTU_LEBAR_MM * MM;
    const cardHeight = KARTU_TINGGI_MM * MM;
    const gapX = 8 * MM;
    const gapY = 4 * MM;
    const startX = (a4Width - cardWidth * 2 - gapX) / 2;
    const startY = a4Height - 12 * MM - cardHeight;

    const doc = await PDFDocument.create();
    const { fontBiasa, fontTebal } = await siapkanFont(doc);

    const perHalaman = 10;
    for (let index = 0; index < Math.max(cards.length, 1); index += perHalaman) {
        const page = doc.addPage([a4Width, a4Height]);
        const kelompok = cards.slice(index, index + perHalaman);

        for (const [posisi, card] of kelompok.entries()) {
            const kolom = posisi % 2;
            const baris = Math.floor(posisi / 2);

            await gambarKartu({
                doc,
                page,
                template,
                data: card,
                originX: startX + kolom * (cardWidth + gapX),
                originY: startY - baris * (cardHeight + gapY),
                fontBiasa,
                fontTebal,
                origin,
            });
        }
    }

    return toArrayBuffer(await doc.save());
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

