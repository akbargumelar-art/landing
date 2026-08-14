import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

/**
 * Penyaji berkas unggahan.
 *
 * Sebelumnya ada DUA route untuk ini -- `[filename]` untuk satu segmen dan `[...filename]`
 * untuk path bersarang -- dan keduanya sudah menyimpang: peta content-type versi catch-all
 * tidak memuat `.ico`, sehingga berkas yang sama disajikan `image/x-icon` di root tetapi
 * `application/octet-stream` di subfolder dan tidak dirender browser. Route catch-all ini
 * mencakup kedua kasus, jadi yang satunya dihapus dan petanya disatukan di sini.
 */

const TIPE_KONTEN: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    ico: "image/x-icon",
    svg: "image/svg+xml",
    pdf: "application/pdf",
};

/** Lebar thumbnail yang boleh diminta. Dibatasi agar tidak bisa dipakai menghabiskan CPU. */
const LEBAR_DIIZINKAN = new Set([160, 320, 480, 640, 960]);

const BISA_DIPERKECIL = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(
    request: Request,
    { params }: { params: Promise<{ filename: string[] }> }
) {
    try {
        const { filename } = await params;
        const akarUnggahan = path.join(process.cwd(), "public", "uploads");

        // Penjagaan directory traversal: alih-alih membuang pola "../" dengan regex --
        // yang selalu bisa diakali dengan penyandian atau pemisah campuran -- path akhirnya
        // diselesaikan lebih dulu lalu dipastikan masih berada DI DALAM folder unggahan.
        const target = path.resolve(akarUnggahan, ...filename);
        if (target !== akarUnggahan && !target.startsWith(akarUnggahan + path.sep)) {
            return new NextResponse("File not found", { status: 404 });
        }

        const isi = await readFile(target);
        const ext = path.extname(target).slice(1).toLowerCase();
        const tipe = TIPE_KONTEN[ext] || "application/octet-stream";

        const headers: Record<string, string> = {
            "Content-Type": tipe,
            "Cache-Control": "public, max-age=31536000, immutable",
            // Jangan biarkan browser menebak tipe lain dari isi berkas.
            "X-Content-Type-Options": "nosniff",
        };

        // SVG adalah dokumen, bukan sekadar gambar: ia bisa memuat <script> dan berjalan
        // pada origin yang sama dengan panel admin bila dibuka langsung. CSP di bawah
        // mematikan seluruh sub-sumber daya dan skrip, sementara pemakaian normal lewat
        // <img src="..."> tetap berfungsi.
        if (tipe === "image/svg+xml") {
            headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
        }

        /**
         * Versi kecil atas permintaan (`?w=320`).
         *
         * Foto outlet diunggah apa adanya dari kamera ponsel: rata-rata ~400 KB dan ada yang
         * menyentuh 5 MB. Galeri menampilkan puluhan sekaligus dalam petak selebar beberapa
         * ratus piksel, jadi menyajikan berkas asli berarti memindahkan puluhan megabyte
         * untuk gambar yang toh diperkecil browser -- petaknya tinggal abu-abu berkepanjangan
         * dan terbaca sebagai foto yang tidak muncul. Ukuran penuh tetap disajikan bila `w`
         * tidak diminta, sehingga pratinjau besar dan tautan "buka ukuran penuh" tidak berubah.
         */
        const w = Number(new URL(request.url).searchParams.get("w") || "0");
        if (LEBAR_DIIZINKAN.has(w) && BISA_DIPERKECIL.has(tipe)) {
            try {
                const kecil = await sharp(isi)
                    .rotate() // hormati EXIF orientation, jika tidak foto ponsel bisa terbaring
                    .resize({ width: w, withoutEnlargement: true })
                    .webp({ quality: 72 })
                    .toBuffer();

                return new NextResponse(new Uint8Array(kecil), {
                    headers: { ...headers, "Content-Type": "image/webp" },
                });
            } catch {
                // Berkas cacat sebagian masih bisa ditampilkan browser walau sharp menolaknya
                // (log unggahan memuat beberapa "Corrupt JPEG data"). Jatuh kembali ke berkas
                // asli lebih baik daripada memunculkan petak kosong.
            }
        }

        return new NextResponse(new Uint8Array(isi), { headers });
    } catch {
        return new NextResponse("File not found", { status: 404 });
    }
}
