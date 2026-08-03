import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { db } from "@/db";
import { mitraOutlets } from "@/db/schema";
import { requireRole, writeAdminAuditLog } from "@/lib/admin-auth";
import { buildOutletPublicUrl, getClientIp } from "@/lib/mitra-utils";

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

    const pdf = await buildBulkCardsPdf(
        outlets.map((outlet) => ({
            name: outlet.name,
            code: outlet.outletCode,
            url: buildOutletPublicUrl(outlet.publicToken, request),
        }))
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

async function buildBulkCardsPdf(cards: { name: string; code: string; url: string }[]) {
    const mm = 2.834645669;
    const a4Width = 210 * mm;
    const a4Height = 297 * mm;
    const cardWidth = 90 * mm;
    const cardHeight = 55 * mm;
    const gapX = 8 * mm;
    const gapY = 4 * mm;
    const startX = (a4Width - cardWidth * 2 - gapX) / 2;
    const startY = a4Height - 12 * mm - cardHeight;

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const normal = await doc.embedFont(StandardFonts.Helvetica);
    let page = doc.addPage([a4Width, a4Height]);

    for (let index = 0; index < cards.length; index++) {
        if (index > 0 && index % 10 === 0) {
            page = doc.addPage([a4Width, a4Height]);
        }

        const slot = index % 10;
        const col = slot % 2;
        const row = Math.floor(slot / 2);
        const x = startX + col * (cardWidth + gapX);
        const y = startY - row * (cardHeight + gapY);
        const card = cards[index];
        const qr = await QRCode.toBuffer(card.url, { type: "png", margin: 1, scale: 6 });
        const qrImage = await doc.embedPng(qr);

        page.drawRectangle({
            x,
            y,
            width: cardWidth,
            height: cardHeight,
            color: rgb(1, 1, 1),
            borderColor: rgb(0.86, 0.86, 0.86),
            borderWidth: 0.8,
        });
        page.drawRectangle({
            x,
            y: y + cardHeight - 18,
            width: cardWidth,
            height: 18,
            color: rgb(0.93, 0.01, 0.15),
        });
        page.drawText("ABK Ciraya Mitra Outlet", {
            x: x + 10,
            y: y + cardHeight - 12,
            size: 7,
            font,
            color: rgb(1, 1, 1),
        });
        page.drawImage(qrImage, {
            x: x + 10,
            y: y + 20,
            width: 75,
            height: 75,
        });
        page.drawText(trim(card.name, 26), {
            x: x + 95,
            y: y + cardHeight - 42,
            size: 8.5,
            font,
            color: rgb(0.1, 0.1, 0.1),
        });
        page.drawText(card.code, {
            x: x + 95,
            y: y + cardHeight - 56,
            size: 7,
            font: normal,
            color: rgb(0.35, 0.35, 0.35),
        });
        page.drawText("Scan profil outlet", {
            x: x + 95,
            y: y + 26,
            size: 7,
            font: normal,
            color: rgb(0.2, 0.2, 0.2),
        });
    }

    return toArrayBuffer(await doc.save());
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function trim(value: string, max: number) {
    return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
