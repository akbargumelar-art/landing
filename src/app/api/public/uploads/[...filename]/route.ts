import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ filename: string[] }> }
) {
    try {
        const { filename } = await params;

        // filename is an array like ['submissions', 'file.jpg']
        // Join them to form the relative path
        const relativePath = filename.join('/');

        // Sanitize to prevent directory traversal
        // Ensure no '..' or absolute paths are used
        const safePath = path.posix.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');

        const filePath = path.join(process.cwd(), "public", "uploads", safePath);

        const fileBuffer = await readFile(filePath);

        // Determine content type
        const ext = safePath.split('.').pop()?.toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "png") contentType = "image/png";
        else if (ext === "webp") contentType = "image/webp";
        else if (ext === "svg") contentType = "image/svg+xml";
        else if (ext === "gif") contentType = "image/gif";
        else if (ext === "pdf") contentType = "application/pdf";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        return new NextResponse("File not found", { status: 404 });
    }
}
