import { NextResponse } from "next/server";
import { and, count, eq, gt } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOtpRequests } from "@/db/schema";
import { findMatchingWhitelist, getMitraOutletRecordByToken, writeWhitelistUsage } from "@/lib/mitra-data";
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

// Balasan sengaja tidak lagi generik: pemilik outlet meminta pengunjung langsung tahu
// apakah nomornya berhak atau tidak. Konsekuensinya endpoint ini bisa dipakai menebak
// nomor mana yang masuk whitelist, jadi rate limit di bawah adalah pengaman utamanya.
const NOT_ELIGIBLE_MESSAGE = "Nomor WhatsApp ini tidak berhak membuka detail outlet. Hubungi admin bila menurut Anda ini keliru.";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const outlet = await getMitraOutletRecordByToken(publicToken);

    if (!outlet) {
        return NextResponse.json(
            { eligible: false, title: "Outlet Tidak Ditemukan", message: "Outlet tidak ditemukan atau tautannya sudah tidak berlaku." },
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

    // Batas per nomor berlaku terpisah untuk setiap outlet. Nomor yang sama
    // boleh langsung meminta OTP saat membuka outlet lain.
    const [[recentPhone], [hourPhone], [dayPhone], [hourIp]] = await Promise.all([
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.phoneE164, phoneE164), eq(mitraOtpRequests.outletId, outlet.id), gt(mitraOtpRequests.createdAt, oneMinuteAgo))),
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.phoneE164, phoneE164), eq(mitraOtpRequests.outletId, outlet.id), gt(mitraOtpRequests.createdAt, oneHourAgo))),
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.phoneE164, phoneE164), eq(mitraOtpRequests.outletId, outlet.id), gt(mitraOtpRequests.createdAt, oneDayAgo))),
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.ip, ip), gt(mitraOtpRequests.createdAt, oneHourAgo))),
    ]);

    if ((recentPhone?.value || 0) >= 1 || (hourPhone?.value || 0) >= 5 || (dayPhone?.value || 0) >= 10 || (hourIp?.value || 0) >= 15) {
        return NextResponse.json(
            { eligible: false, title: "Terlalu Sering Meminta OTP", message: "Permintaan OTP terlalu sering. Tunggu beberapa menit sebelum mencoba lagi." },
            { status: 429 }
        );
    }

    const whitelist = await findMatchingWhitelist(phoneE164, {
        id: outlet.id,
        tap: outlet.tap,
    });

    if (!whitelist) {
        await writeWhitelistUsage({
            phoneE164,
            outletId: outlet.id,
            action: "OTP_REJECTED",
            ip,
        });
        return NextResponse.json({ eligible: false, title: "Nomor Tidak Berhak", message: NOT_ELIGIBLE_MESSAGE }, { status: 403 });
    }

    const code = generateOtpCode();
    const { hash, salt } = createOtpHash(code);

    await db.insert(mitraOtpRequests).values({
        id: uuid(),
        phoneE164,
        outletId: outlet.id,
        whitelistId: whitelist.id,
        codeHash: hash,
        codeSalt: salt,
        purpose: "OUTLET_DETAIL",
        attempts: 0,
        expiresAt: addMinutes(now, MITRA_OTP_TTL_MINUTES),
        ip,
        userAgent,
        createdAt: now,
    });

    await writeWhitelistUsage({
        whitelistId: whitelist.id,
        phoneE164,
        outletId: outlet.id,
        action: "OTP_REQUESTED",
        ip,
    });

    const otpTemplate = await getOtpTemplate();
    const sent = await sendTemplatedWhatsApp(phoneE164, otpTemplate, {
        name: whitelist.name || outlet.name,
        programName: "Portal Mitra Outlet",
        otp: code,
        outlet: outlet.name,
        expires: `${MITRA_OTP_TTL_MINUTES} menit`,
    });

    if (!sent.ok) {
        console.error("[OTP] Gagal mengirim OTP via WAHA:", sent.error);
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
