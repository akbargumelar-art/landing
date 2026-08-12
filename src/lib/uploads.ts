import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { v4 as uuid } from "uuid";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/x-icon", "image/gif"];

/** Tipe yang aman diterima dari pengunjung publik: SVG sengaja tidak termasuk karena bisa memuat skrip. */
const PUBLIC_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Tipe yang TIDAK boleh dikompres. SVG adalah vektor, ICO wadah multi-ukuran, dan GIF bisa
 * beranimasi -- ketiganya rusak atau kehilangan sifatnya bila diratakan jadi satu JPEG.
 * Selain ini, apa pun dicoba dikompres; yang tidak terbaca sharp jatuh ke berkas asli.
 */
const TIPE_TANPA_KOMPRESI = ["image/svg+xml", "image/x-icon", "image/gif"];

export interface HasilUnggah {
    ok: boolean;
    url?: string;
    filename?: string;
    error?: string;
    status?: number;
}

/**
 * Menyimpan satu berkas gambar ke public/uploads dan mengembalikan URL publiknya.
 *
 * Dipakai dua jalur dengan aturan berbeda: admin (semua tipe gambar, 20 MB) dan mitra
 * pemegang OTP (hanya foto kamera, 5 MB, tanpa SVG). Perbedaannya diatur lewat opsi,
 * bukan lewat dua salinan kode -- validasi unggahan adalah tempat yang paling tidak
 * boleh berbeda diam-diam antar jalur.
 */
export async function saveUploadedImage(
    file: File | null,
    options: { maxBytes?: number; publicUpload?: boolean; maxDimensi?: number; kualitas?: number } = {}
): Promise<HasilUnggah> {
    const { maxBytes = 20 * 1024 * 1024, publicUpload = false, maxDimensi, kualitas = 80 } = options;
    const allowed = publicUpload ? PUBLIC_ALLOWED_TYPES : ALLOWED_TYPES;

    if (!file) {
        return { ok: false, error: "Berkas tidak ditemukan", status: 400 };
    }

    if (file.type && !allowed.includes(file.type)) {
        return {
            ok: false,
            error: publicUpload
                ? "Format foto harus JPG, PNG, atau WebP."
                : "File type not allowed. Use JPG, PNG, WebP, SVG, ICO, or GIF.",
            status: 400,
        };
    }

    if (file.size > maxBytes) {
        return {
            ok: false,
            error: `Ukuran berkas melebihi ${Math.round(maxBytes / (1024 * 1024))} MB.`,
            status: 400,
        };
    }

    // Dianotasi eksplisit: Buffer.from() menyempitkan tipe ke Buffer<ArrayBuffer>, sedangkan
    // hasil sharp bertipe Buffer<ArrayBufferLike> dan tidak bisa ditugaskan ke sana.
    let buffer: Buffer = Buffer.from(await file.arrayBuffer());

    // Ekstensi diturunkan dari tipe MIME yang sudah divalidasi, bukan dari nama berkas
    // kiriman, supaya nama seperti "foto.php.jpg" tidak menentukan apa pun.
    let ext = extensionForType(file.type) || (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");

    if (maxDimensi && !TIPE_TANPA_KOMPRESI.includes(file.type)) {
        const dikompres = await kompresGambar(buffer, maxDimensi, kualitas);
        if (dikompres) {
            buffer = dikompres;
            ext = "jpg";
        }
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const filename = `${uuid()}.${ext || "jpg"}`;

    await writeFile(path.join(uploadDir, filename), buffer);

    return { ok: true, url: `/api/public/uploads/${filename}`, filename };
}

/**
 * Memperkecil foto ke sisi terpanjang `maxDimensi` dan menyandikannya ulang sebagai JPEG.
 *
 * Mengembalikan null bila gagal, dan pemanggil menyimpan berkas aslinya. Kompresi adalah
 * penghematan, bukan syarat sah: unggahan salesforce yang sudah tersimpan tidak boleh
 * dinyatakan gagal hanya karena satu berkas tidak terbaca sharp.
 */
async function kompresGambar(buffer: Buffer, maxDimensi: number, kualitas: number): Promise<Buffer | null> {
    try {
        return await sharp(buffer)
            // Kamera ponsel menandai orientasi di EXIF alih-alih memutar pikselnya, dan
            // penyandian ulang membuang metadata itu. Tanpa rotate() lebih dulu, foto
            // potret tersimpan miring.
            .rotate()
            // withoutEnlargement: foto yang sudah kecil dibiarkan, tidak diperbesar paksa.
            .resize(maxDimensi, maxDimensi, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: kualitas, mozjpeg: true })
            .toBuffer();
    } catch (error) {
        console.error("[Unggah] Kompresi gagal, berkas asli yang disimpan:", error);
        return null;
    }
}

function extensionForType(type: string): string {
    const map: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/svg+xml": "svg",
        "image/x-icon": "ico",
    };
    return map[type] || "";
}
