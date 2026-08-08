import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getPublicOutletByToken } from "@/lib/mitra-data";
import { buildOutletPublicUrl } from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const outlet = await getPublicOutletByToken(publicToken);

    if (!outlet) {
        return NextResponse.json({ error: "Outlet tidak ditemukan" }, { status: 404 });
    }

    const url = buildOutletPublicUrl(publicToken, request);
    const searchParams = new URL(request.url).searchParams;
    const format = searchParams.get("format") || "svg";
    // Tanpa ?dl=1 berkas dibuka inline supaya admin bisa mengintipnya di tab baru.
    // Dengan ?dl=1 browser menyimpannya sebagai unduhan dan pengunjung tidak berpindah
    // halaman -- ini yang dipakai tombol "Download QR" di profil publik, karena halaman
    // SVG mentah tidak punya jalan kembali ke profil.
    const disposition = searchParams.get("dl") === "1" ? "attachment" : "inline";

    if (format === "png") {
        const png = await QRCode.toBuffer(url, { type: "png", margin: 1, scale: 10 });
        return new NextResponse(toArrayBuffer(png), {
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": `${disposition}; filename="qr-${outlet.outletCode}.png"`,
            },
        });
    }

    if (format === "pdf" || format === "card") {
        const pdf = await buildSingleCardPdf(url, outlet.name, outlet.outletCode);
        return new NextResponse(pdf, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `${disposition}; filename="qr-card-${outlet.outletCode}.pdf"`,
            },
        });
    }

    const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 512 });
    return new NextResponse(svg, {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Content-Disposition": `${disposition}; filename="qr-${outlet.outletCode}.svg"`,
        },
    });
}

async function buildSingleCardPdf(url: string, outletName: string, outletCode: string) {
    const mm = 2.834645669;
    const width = 90 * mm;
    const height = 55 * mm;
    const doc = await PDFDocument.create();
    const page = doc.addPage([width, height]);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const normalFont = await doc.embedFont(StandardFonts.Helvetica);
    const png = await QRCode.toBuffer(url, { type: "png", margin: 1, scale: 8 });
    const qrImage = await doc.embedPng(png);

    page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.89, 0.02, 0.12),
        borderWidth: 1,
    });

    page.drawRectangle({
        x: 0,
        y: height - 20,
        width,
        height: 20,
        color: rgb(0.93, 0.01, 0.15),
    });

    page.drawText("ABK Ciraya Mitra Outlet", {
        x: 12,
        y: height - 14,
        size: 8,
        font,
        color: rgb(1, 1, 1),
    });

    const qrSize = 82;
    page.drawImage(qrImage, {
        x: 12,
        y: 22,
        width: qrSize,
        height: qrSize,
    });

    page.drawText(trimPdfText(outletName, 28), {
        x: 106,
        y: height - 48,
        size: 10,
        font,
        color: rgb(0.09, 0.09, 0.09),
    });

    page.drawText(outletCode, {
        x: 106,
        y: height - 64,
        size: 8,
        font: normalFont,
        color: rgb(0.35, 0.35, 0.35),
    });

    page.drawText("Scan untuk profil outlet", {
        x: 106,
        y: 36,
        size: 8,
        font: normalFont,
        color: rgb(0.09, 0.09, 0.09),
    });

    page.drawText(trimPdfText(url, 42), {
        x: 12,
        y: 10,
        size: 5.5,
        font: normalFont,
        color: rgb(0.4, 0.4, 0.4),
    });

    return toArrayBuffer(await doc.save());
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function trimPdfText(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
