import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

// Increase body size limit for file uploads (default is 1MB)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function POST(request: Request) {
    try {
        let formData;
        try {
            formData = await request.formData();
        } catch (formError) {
            console.error("Failed to parse formData:", formError);
            return NextResponse.json({ error: "Failed to parse upload data" }, { status: 400 });
        }

        const file = formData.get("file") as File | null;

        if (!file) {
            console.error("No file found in formData");
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/x-icon", "image/gif"];
        if (file.type && !allowedTypes.includes(file.type)) {
            console.error(`Invalid file type rejected: "${file.type}"`);
            return NextResponse.json(
                { error: "File type not allowed. Use JPG, PNG, WebP, SVG, ICO, or GIF." },
                { status: 400 }
            );
        }

        // Max 20MB
        if (file.size > 20 * 1024 * 1024) {
            console.error(`File too large: ${file.size} bytes`);
            return NextResponse.json({ error: "File too large. Max 20MB." }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create upload directory
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const ext = file.name.split(".").pop() || "jpg";
        const filename = `${uuid()}.${ext}`;
        const filepath = path.join(uploadDir, filename);

        await writeFile(filepath, buffer);

        const url = `/api/public/uploads/${filename}`;

        return NextResponse.json({ success: true, url, filename });
    } catch (error: unknown) {
        console.error("Upload error:", error);
        const msg = error instanceof Error ? error.message : "Upload failed";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
