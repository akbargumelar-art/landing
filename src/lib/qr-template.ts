import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

/** Ukuran kartu tetap 90 x 55 mm; seluruh koordinat template mengacu ke sini. */
export const KARTU_LEBAR_MM = 90;
export const KARTU_TINGGI_MM = 55;

/** 1 mm dalam satuan titik PDF. */
export const MM = 2.834645669;

/** Field outlet yang boleh dicetak di kartu. `teks` berarti tulisan tetap. */
export const QR_FIELDS = [
    { key: "outletName", label: "Nama Outlet" },
    { key: "outletCode", label: "Kode Outlet" },
    { key: "tap", label: "TAP" },
    { key: "kabupaten", label: "Kabupaten" },
    { key: "kecamatan", label: "Kecamatan" },
    { key: "ownerName", label: "Nama Owner" },
    { key: "url", label: "Tautan Profil" },
    { key: "teks", label: "Tulisan Tetap" },
] as const;

export type QrFieldKey = (typeof QR_FIELDS)[number]["key"];

export interface QrElement {
    id: string;
    field: QrFieldKey;
    /** Isi untuk field "teks"; diabaikan untuk field lain. */
    text?: string;
    /** Posisi kiri-atas elemen dalam mm, dihitung dari sudut kiri-atas kartu. */
    x: number;
    y: number;
    fontSize: number;
    color: string;
    bold: boolean;
    /** Lebar maksimum dalam mm sebelum teks dipotong. */
    maxWidth: number;
}

/** Gambar tempelan: logo perusahaan, logo operator, stiker, dan sebagainya. */
export interface QrImage {
    id: string;
    url: string;
    /** Posisi kiri-atas dalam mm dari sudut kiri-atas kartu. */
    x: number;
    y: number;
    /** Lebar dalam mm; tingginya mengikuti rasio asli gambar. */
    width: number;
}

export interface QrTemplate {
    name: string;
    backgroundColor: string;
    backgroundImageUrl: string | null;
    images: QrImage[];
    qrX: number;
    qrY: number;
    qrSize: number;
    elements: QrElement[];
}

export interface QrCardData {
    outletName: string;
    outletCode: string;
    tap?: string | null;
    kabupaten?: string | null;
    kecamatan?: string | null;
    ownerName?: string | null;
    url: string;
}

/**
 * Template bawaan, dipakai selama admin belum membuat satu pun. Isinya menyalin tata letak
 * kartu lama supaya hasil cetak tidak berubah mendadak bagi yang belum menyentuh fitur ini.
 */
export const TEMPLATE_BAWAAN: QrTemplate = {
    name: "Bawaan ABK",
    backgroundColor: "#ffffff",
    backgroundImageUrl: null,
    images: [],
    qrX: 4.2,
    qrY: 12,
    qrSize: 29,
    elements: [
        { id: "judul", field: "teks", text: "ABK Ciraya Mitra Outlet", x: 4.2, y: 2.5, fontSize: 8, color: "#ffffff", bold: true, maxWidth: 80 },
        { id: "nama", field: "outletName", x: 37, y: 15, fontSize: 10, color: "#171717", bold: true, maxWidth: 48 },
        { id: "kode", field: "outletCode", x: 37, y: 21, fontSize: 8, color: "#595959", bold: false, maxWidth: 48 },
        { id: "ajakan", field: "teks", text: "Scan untuk profil outlet", x: 37, y: 41, fontSize: 8, color: "#171717", bold: false, maxWidth: 48 },
        { id: "tautan", field: "url", x: 4.2, y: 50, fontSize: 5.5, color: "#666666", bold: false, maxWidth: 82 },
    ],
};

export function hexToRgb(hex: string) {
    const bersih = (hex || "").replace("#", "").trim();
    const utuh = bersih.length === 3 ? bersih.split("").map((c) => c + c).join("") : bersih;
    const angka = Number.parseInt(utuh || "000000", 16);

    if (!Number.isFinite(angka)) return rgb(0, 0, 0);
    return rgb(((angka >> 16) & 255) / 255, ((angka >> 8) & 255) / 255, (angka & 255) / 255);
}

export function nilaiField(element: QrElement, data: QrCardData): string {
    if (element.field === "teks") return element.text || "";
    const nilai = data[element.field as keyof QrCardData];
    return nilai ? String(nilai) : "";
}

/** Memotong teks yang melebihi lebar maksimum supaya tidak menimpa elemen tetangganya. */
function potongMuat(font: PDFFont, teks: string, ukuran: number, maxWidthMm: number): string {
    const batas = maxWidthMm * MM;
    if (font.widthOfTextAtSize(teks, ukuran) <= batas) return teks;

    let hasil = teks;
    while (hasil.length > 1 && font.widthOfTextAtSize(`${hasil}...`, ukuran) > batas) {
        hasil = hasil.slice(0, -1);
    }
    return `${hasil}...`;
}

async function muatGambar(doc: PDFDocument, url: string, origin: string) {
    // URL relatif (mis. /api/public/uploads/x.png) diubah menjadi absolut supaya bisa
    // diambil dari sisi server, tempat tidak ada konsep "halaman saat ini".
    const absolut = url.startsWith("http") ? url : `${origin}${url}`;
    const response = await fetch(absolut);
    if (!response.ok) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    const tipe = response.headers.get("content-type") || "";

    try {
        if (tipe.includes("png")) return await doc.embedPng(bytes);
        return await doc.embedJpg(bytes);
    } catch {
        // Format lain (mis. WebP) tidak didukung pdf-lib; kartunya tetap tercetak tanpa gambar.
        return null;
    }
}

/**
 * Menggambar satu kartu pada posisi (originX, originY) diukur dari sudut KIRI-BAWAH halaman,
 * sesuai sistem koordinat PDF. Koordinat template sendiri memakai kiri-atas kartu karena
 * itu yang intuitif saat menata, jadi konversinya dilakukan di sini sekali saja.
 */
export async function gambarKartu(options: {
    doc: PDFDocument;
    page: PDFPage;
    template: QrTemplate;
    data: QrCardData;
    originX: number;
    originY: number;
    fontBiasa: PDFFont;
    fontTebal: PDFFont;
    origin: string;
}) {
    const { doc, page, template, data, originX, originY, fontBiasa, fontTebal, origin } = options;
    const lebar = KARTU_LEBAR_MM * MM;
    const tinggi = KARTU_TINGGI_MM * MM;

    /** mm dari atas kartu -> titik dari bawah halaman. */
    const dariAtas = (mmDariAtas: number) => originY + tinggi - mmDariAtas * MM;

    page.drawRectangle({
        x: originX,
        y: originY,
        width: lebar,
        height: tinggi,
        color: hexToRgb(template.backgroundColor),
        borderColor: rgb(0.89, 0.02, 0.12),
        borderWidth: template.backgroundImageUrl ? 0 : 1,
    });

    if (template.backgroundImageUrl) {
        const gambar = await muatGambar(doc, template.backgroundImageUrl, origin);
        if (gambar) {
            page.drawImage(gambar, { x: originX, y: originY, width: lebar, height: tinggi });
        }
    }

    // Digambar berurutan sesuai daftar, jadi gambar berikutnya menimpa yang sebelumnya
    // bila posisinya bertumpuk -- urutan pada editor menentukan lapisannya.
    for (const image of template.images) {
        if (!image.url) continue;

        const gambar = await muatGambar(doc, image.url, origin);
        if (!gambar) continue;

        const lebar = image.width * MM;
        // Tinggi mengikuti rasio asli supaya gambar tidak gepeng.
        const tinggi = lebar * (gambar.height / gambar.width);
        page.drawImage(gambar, {
            x: originX + image.x * MM,
            y: dariAtas(image.y) - tinggi,
            width: lebar,
            height: tinggi,
        });
    }

    const qrPng = await QRCode.toBuffer(data.url, { type: "png", margin: 0, scale: 8 });
    const qrImage = await doc.embedPng(qrPng);
    const ukuranQr = template.qrSize * MM;
    page.drawImage(qrImage, {
        x: originX + template.qrX * MM,
        y: dariAtas(template.qrY) - ukuranQr,
        width: ukuranQr,
        height: ukuranQr,
    });

    for (const element of template.elements) {
        const teks = nilaiField(element, data);
        if (!teks) continue;

        const font = element.bold ? fontTebal : fontBiasa;
        page.drawText(potongMuat(font, teks, element.fontSize, element.maxWidth), {
            x: originX + element.x * MM,
            // drawText memakai garis dasar huruf, sedangkan template memakai tepi atas teks.
            y: dariAtas(element.y) - element.fontSize,
            size: element.fontSize,
            font,
            color: hexToRgb(element.color),
        });
    }
}

export async function siapkanFont(doc: PDFDocument) {
    return {
        fontBiasa: await doc.embedFont(StandardFonts.Helvetica),
        fontTebal: await doc.embedFont(StandardFonts.HelveticaBold),
    };
}
