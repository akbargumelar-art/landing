import { NextResponse } from "next/server";
import { and, count, eq, gt } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOtpRequests, mitraPrograms } from "@/db/schema";
import { findActiveWhitelistNumber, writeWhitelistUsage } from "@/lib/mitra-data";
import { getOtpTemplate, sendTemplatedWhatsApp } from "@/lib/whatsapp";
import {
    MITRA_OTP_TTL_MINUTES,
    addMinutes,
    createOtpHash,
    generateOtpCode,
    getClientIp,
    normalizePhoneE164,
} from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

/**
 * OTP untuk membuka halaman program salesforce. Isi program menyangkut pencapaian dan
 * insentif tiap orang, jadi hanya nomor yang terdaftar di whitelist OTP yang boleh
 * melihatnya -- berbeda dari program outlet yang papan peringkatnya memang terbuka.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const [program] = await db
        .select({ id: mitraPrograms.id, name: mitraPrograms.name })
        .from(mitraPrograms)
        .where(and(eq(mitraPrograms.slug, slug), eq(mitraPrograms.targetType, "SALESFORCE"), eq(mitraPrograms.isPublic, true)))
        .limit(1);

    if (!program) {
        return NextResponse.json(
            { eligible: false, title: "Program Tidak Ditemukan", message: "Program tidak ditemukan atau belum dipublikasikan." },
            { status: 404 }
        );
    }

    const body = await request.json().catch(() => ({}));
    const phoneE164 = normalizePhoneE164(String(body.phone || ""));
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || "";

    if (!phoneE164) {
        return NextResponse.json(
            { eligible: false, title: "Nomor Tidak Valid", message: "Nomor WhatsApp tidak valid. Contoh penulisan: 081234567890." },
            { status: 400 }
        );
    }

    const now = new Date();
    const oneMinuteAgo = addMinutes(now, -1);
    const oneHourAgo = addMinutes(now, -60);
    const oneDayAgo = addMinutes(now, -60 * 24);

    // Ambang sama seperti OTP outlet, dihitung per program supaya nomor yang sama tetap
    // bisa membuka program lain tanpa menunggu.
    const [[recentPhone], [hourPhone], [dayPhone], [hourIpSameProgram], [hourIpAllPrograms]] = await Promise.all([
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.phoneE164, phoneE164), eq(mitraOtpRequests.programId, program.id), gt(mitraOtpRequests.createdAt, oneMinuteAgo))),
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.phoneE164, phoneE164), eq(mitraOtpRequests.programId, program.id), gt(mitraOtpRequests.createdAt, oneHourAgo))),
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.phoneE164, phoneE164), eq(mitraOtpRequests.programId, program.id), gt(mitraOtpRequests.createdAt, oneDayAgo))),
        // Batas IP bertingkat (kustomisasi owner): 10x/jam untuk program yang sama,
        // 20x/jam untuk seluruh program. Jangan diganti batas IP global tunggal.
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.ip, ip), eq(mitraOtpRequests.programId, program.id), gt(mitraOtpRequests.createdAt, oneHourAgo))),
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.ip, ip), gt(mitraOtpRequests.createdAt, oneHourAgo))),
    ]);

    if ((recentPhone?.value || 0) >= 1 || (hourPhone?.value || 0) >= 5 || (dayPhone?.value || 0) >= 10 || (hourIpSameProgram?.value || 0) >= 10 || (hourIpAllPrograms?.value || 0) >= 20) {
        return NextResponse.json(
            { eligible: false, title: "Terlalu Sering Meminta OTP", message: "Permintaan OTP terlalu sering. Tunggu beberapa menit sebelum mencoba lagi." },
            { status: 429 }
        );
    }

    const whitelist = await findActiveWhitelistNumber(phoneE164);
    if (!whitelist) {
        await writeWhitelistUsage({ phoneE164, programId: program.id, action: "OTP_REJECTED", ip });
        return NextResponse.json(
            {
                eligible: false,
                title: "Nomor Tidak Berhak",
                message: "Nomor WhatsApp ini tidak terdaftar untuk membuka program salesforce. Hubungi admin bila menurut Anda ini keliru.",
            },
            { status: 403 }
        );
    }

    const code = generateOtpCode();
    const { hash, salt } = createOtpHash(code);

    await db.insert(mitraOtpRequests).values({
        id: uuid(),
        phoneE164,
        programId: program.id,
        whitelistId: whitelist.id,
        codeHash: hash,
        codeSalt: salt,
        purpose: "PROGRAM_DETAIL",
        attempts: 0,
        expiresAt: addMinutes(now, MITRA_OTP_TTL_MINUTES),
        ip,
        userAgent,
        createdAt: now,
    });

    await writeWhitelistUsage({ whitelistId: whitelist.id, phoneE164, programId: program.id, action: "OTP_REQUESTED", ip });

    const otpTemplate = await getOtpTemplate();
    const sent = await sendTemplatedWhatsApp(phoneE164, otpTemplate, {
        name: whitelist.name || "Rekan Salesforce",
        programName: program.name,
        otp: code,
        outlet: program.name,
        expires: `${MITRA_OTP_TTL_MINUTES} menit`,
    });

    if (!sent.ok) {
        console.error("[OTP Program] Gagal mengirim OTP via WAHA:", sent.error);
        return NextResponse.json(
            { eligible: true, title: "Pengiriman OTP Gagal", message: "Nomor Anda terdaftar, tetapi pengiriman WhatsApp sedang gagal. Coba lagi beberapa saat." },
            { status: 502 }
        );
    }

    return NextResponse.json({
        eligible: true,
        title: "Cek WhatsApp Anda",
        message: `Kode OTP sudah dikirim. Silakan cek WhatsApp Anda, kode berlaku ${MITRA_OTP_TTL_MINUTES} menit.`,
    });
}
