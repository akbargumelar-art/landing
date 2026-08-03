import { NextResponse } from "next/server";
import { and, count, eq, gte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db } from "@/db";
import { indihomeLeads, indihomeProducts } from "@/db/schema";
import { isIndihomeLocation } from "@/lib/indihome-products";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
    if (digits.startsWith("62")) return `+${digits}`;
    return digits.startsWith("8") ? `+62${digits}` : `+${digits}`;
}

function getClientIp(request: Request) {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown"
    );
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const fullName = String(body.fullName || "").trim();
        const phoneE164 = normalizePhone(String(body.phone || ""));
        const email = String(body.email || "").trim().toLowerCase();
        const location = String(body.location || "").trim();
        const district = String(body.district || "").trim();
        const address = String(body.address || "").trim();
        const packageId = String(body.packageId || "").trim();
        const consent = body.consent === true;

        // A filled honeypot is treated as a successful no-op to avoid helping bots adapt.
        if (String(body.company || "").trim()) {
            return NextResponse.json({ success: true, reference: "DITERIMA" }, { status: 201 });
        }

        if (fullName.length < 3 || fullName.length > 255) {
            return NextResponse.json({ error: "Nama lengkap belum valid." }, { status: 400 });
        }
        if (!/^\+62\d{8,13}$/.test(phoneE164)) {
            return NextResponse.json({ error: "Nomor WhatsApp belum valid." }, { status: 400 });
        }
        if (email && !EMAIL_PATTERN.test(email)) {
            return NextResponse.json({ error: "Alamat email belum valid." }, { status: 400 });
        }
        if (!isIndihomeLocation(location)) {
            return NextResponse.json({ error: "Pilih lokasi pemasangan yang tersedia." }, { status: 400 });
        }
        if (district.length < 3 || district.length > 120 || address.length < 10 || address.length > 2_000) {
            return NextResponse.json({ error: "Lengkapi kecamatan dan alamat pemasangan." }, { status: 400 });
        }

        const [product] = await db
            .select()
            .from(indihomeProducts)
            .where(and(eq(indihomeProducts.id, packageId), eq(indihomeProducts.isActive, true)))
            .limit(1);
        if (!product || !product.locations.includes(location)) {
            return NextResponse.json({ error: "Paket tidak tersedia untuk lokasi yang dipilih." }, { status: 400 });
        }
        if (!consent) {
            return NextResponse.json({ error: "Persetujuan penggunaan data wajib diberikan." }, { status: 400 });
        }

        const ip = getClientIp(request);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [[ipRate], [phoneRate]] = await Promise.all([
            db.select({ value: count() })
                .from(indihomeLeads)
                .where(and(eq(indihomeLeads.ip, ip), gte(indihomeLeads.createdAt, oneHourAgo))),
            db.select({ value: count() })
                .from(indihomeLeads)
                .where(and(eq(indihomeLeads.phoneE164, phoneE164), gte(indihomeLeads.createdAt, oneDayAgo))),
        ]);

        if ((ipRate?.value ?? 0) >= 5 || (phoneRate?.value ?? 0) >= 3) {
            return NextResponse.json(
                { error: "Pengajuan terlalu sering. Silakan tunggu sebelum mencoba kembali." },
                { status: 429 },
            );
        }

        const id = uuid();
        await db.insert(indihomeLeads).values({
            id,
            fullName,
            phoneE164,
            email: email || null,
            location,
            district,
            address,
            packageId: product.id,
            packageName: product.name,
            status: "NEW",
            consent,
            source: "landing_indihome",
            ip,
            userAgent: request.headers.get("user-agent"),
            createdAt: new Date(),
        });

        return NextResponse.json(
            { success: true, reference: id.slice(0, 8).toUpperCase() },
            { status: 201 },
        );
    } catch {
        return NextResponse.json(
            { error: "Pengajuan belum dapat disimpan. Silakan coba beberapa saat lagi." },
            { status: 503 },
        );
    }
}
