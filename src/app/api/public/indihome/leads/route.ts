import { NextResponse } from "next/server";
import { and, count, eq, gte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db } from "@/db";
import { indihomeLeads, indihomeProducts } from "@/db/schema";
import { isActiveIndihomeLocation } from "@/lib/indihome-data";
import { getIndihomeTemplate, sendTemplatedWhatsApp } from "@/lib/whatsapp";

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

        // Honeypot. SEBELUMNYA field ini bernama `company` dan pengajuannya dibuang diam-diam
        // sambil tetap membalas sukses. Itu menghilangkan pendaftaran asli tanpa jejak, karena
        // Chrome dan password manager rutin mengisi field bernama "company"/"organization"
        // meski sudah diberi autocomplete="off".
        //
        // Sekarang: namanya tidak lagi menyerupai field profil apa pun, dan bila terisi
        // pengajuannya TETAP DISIMPAN, hanya ditandai lewat kolom `source` supaya admin bisa
        // memilahnya. Lebih baik menyaring spam di dashboard daripada kehilangan calon pelanggan.
        const honeypotTripped = Boolean(String(body.website_hp || "").trim());
        if (honeypotTripped) {
            console.warn("[IndiHome] Honeypot terisi, pengajuan tetap disimpan dan ditandai:", {
                ip: getClientIp(request),
                userAgent: request.headers.get("user-agent"),
            });
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
        if (!(await isActiveIndihomeLocation(location))) {
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
            source: honeypotTripped ? "landing_indihome_suspect" : "landing_indihome",
            ip,
            userAgent: request.headers.get("user-agent"),
            createdAt: new Date(),
        });

        const reference = id.slice(0, 8).toUpperCase();

        // Konfirmasi WhatsApp memakai gateway umum di Pengaturan. Tidak di-await supaya
        // gangguan WAHA tidak menggagalkan pengajuan yang sudah tersimpan.
        getIndihomeTemplate()
            .then((template) => sendTemplatedWhatsApp(phoneE164, template, {
                name: fullName,
                nama: fullName,
                paket: product.name,
                lokasi: location,
                referensi: reference,
            }))
            .then((result) => {
                if (!result.ok) {
                    console.error(`[IndiHome] Konfirmasi WhatsApp gagal untuk ${phoneE164}: ${result.error}`);
                }
            })
            .catch((error) => {
                console.error("[IndiHome] Exception saat mengirim konfirmasi WhatsApp", error);
            });

        return NextResponse.json(
            { success: true, reference },
            { status: 201 },
        );
    } catch {
        return NextResponse.json(
            { error: "Pengajuan belum dapat disimpan. Silakan coba beberapa saat lagi." },
            { status: 503 },
        );
    }
}
