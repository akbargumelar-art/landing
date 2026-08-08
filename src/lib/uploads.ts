import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/x-icon", "image/gif"];

/** Tipe yang aman diterima dari pengunjung publik: SVG sengaja tidak termasuk karena bisa memuat skrip. */
const PUBLIC_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
    options: { maxBytes?: number; publicUpload?: boolean } = {}
): Promise<HasilUnggah> {
    const { maxBytes = 20 * 1024 * 1024, publicUpload = false } = options;
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // Ekstensi diturunkan dari tipe MIME yang sudah divalidasi, bukan dari nama berkas
    // kiriman, supaya nama seperti "foto.php.jpg" tidak menentukan apa pun.
    const ext = extensionForType(file.type) || (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const filename = `${uuid()}.${ext || "jpg"}`;

    await writeFile(path.join(uploadDir, filename), buffer);

    return { ok: true, url: `/api/public/uploads/${filename}`, filename };
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
