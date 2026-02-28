import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params;

        // Sanitize filename
        const safeName = path.basename(filename);
        const filePath = path.join(process.cwd(), "public", "uploads", safeName);

        const fileBuffer = await readFile(filePath);

        // Determine content type
        const ext = safeName.split(".").pop()?.toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "png") contentType = "image/png";
        else if (ext === "webp") contentType = "image/webp";
        else if (ext === "svg") contentType = "image/svg+xml";
        else if (ext === "gif") contentType = "image/gif";
        else if (ext === "ico") contentType = "image/x-icon";
        else if (ext === "pdf") contentType = "application/pdf";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch {
        return new NextResponse("File not found", { status: 404 });
    }
}
