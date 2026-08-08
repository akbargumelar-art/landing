import { NextResponse } from "next/server";

import { requireRole } from "@/lib/admin-auth";
import { saveUploadedImage } from "@/lib/uploads";

// Increase body size limit for file uploads (default is 1MB)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN_INPUT"]);
    if (auth.error) return auth.error;

    try {
        let formData;
        try {
            formData = await request.formData();
        } catch (formError) {
            console.error("Failed to parse formData:", formError);
            return NextResponse.json({ error: "Failed to parse upload data" }, { status: 400 });
        }

        const hasil = await saveUploadedImage(formData.get("file") as File | null);

        if (!hasil.ok) {
            console.error("Upload ditolak:", hasil.error);
            return NextResponse.json({ error: hasil.error }, { status: hasil.status || 400 });
        }

        return NextResponse.json({ success: true, url: hasil.url, filename: hasil.filename });
    } catch (error: unknown) {
        console.error("Upload error:", error);
        const msg = error instanceof Error ? error.message : "Upload failed";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
