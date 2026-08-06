import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

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

export async function GET(
    _request: Request,
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

        return new NextResponse(new Uint8Array(isi), { headers });
    } catch {
        return new NextResponse("File not found", { status: 404 });
    }
}
