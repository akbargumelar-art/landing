import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";

import { getPublicOutletByToken } from "@/lib/mitra-data";
import { buildOutletPublicUrl } from "@/lib/mitra-utils";
import { KARTU_LEBAR_MM, KARTU_TINGGI_MM, MM, gambarKartu, siapkanFont } from "@/lib/qr-template";
import { ambilTemplateCetak } from "@/lib/qr-template-store";

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
        const pdf = await buildSingleCardPdf(url, outlet, request, searchParams.get("template"));
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

/**
 * Tata letaknya kini mengikuti template yang dikelola admin, bukan koordinat yang
 * ditanam di kode. Tanpa template tersimpan, ambilTemplateCetak() mengembalikan
 * TEMPLATE_BAWAAN yang menyalin tata letak lama, jadi hasil cetak tidak berubah bagi
 * yang belum menyentuh fitur template.
 */
async function buildSingleCardPdf(
    url: string,
    outlet: { name: string; outletCode: string; tap?: string | null; kabupaten?: string | null; kecamatan?: string | null },
    request: Request,
    templateId?: string | null
) {
    const template = await ambilTemplateCetak(templateId);
    const doc = await PDFDocument.create();
    const page = doc.addPage([KARTU_LEBAR_MM * MM, KARTU_TINGGI_MM * MM]);
    const { fontBiasa, fontTebal } = await siapkanFont(doc);

    await gambarKartu({
        doc,
        page,
        template,
        data: {
            outletName: outlet.name,
            outletCode: outlet.outletCode,
            tap: outlet.tap,
            kabupaten: outlet.kabupaten,
            kecamatan: outlet.kecamatan,
            url,
        },
        originX: 0,
        originY: 0,
        fontBiasa,
        fontTebal,
        origin: new URL(request.url).origin,
    });

    return toArrayBuffer(await doc.save());
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

