import { NextResponse } from "next/server";
import { and, count, eq, gt } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOtpRequests } from "@/db/schema";
import { findMatchingWhitelist, getMitraOutletRecordByToken, writeWhitelistUsage } from "@/lib/mitra-data";
import { getOtpTemplate, sendTemplatedWhatsApp } from "@/lib/whatsapp";
import {
    addMinutes,
    createOtpHash,
    generateOtpCode,
    getClientIp,
    normalizePhoneE164,
} from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

const GENERIC_MESSAGE = "Jika nomor terdaftar, kode OTP akan dikirim melalui WhatsApp.";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const outlet = await getMitraOutletRecordByToken(publicToken);

    if (!outlet) {
        return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    const body = await request.json().catch(() => ({}));
    const phoneE164 = normalizePhoneE164(String(body.phone || ""));
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || "";

    if (!phoneE164) {
        return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    const now = new Date();
    const oneMinuteAgo = addMinutes(now, -1);
    const oneHourAgo = addMinutes(now, -60);
    const oneDayAgo = addMinutes(now, -60 * 24);

    const [[recentPhone], [hourPhone], [dayPhone], [hourIp]] = await Promise.all([
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.phoneE164, phoneE164), gt(mitraOtpRequests.createdAt, oneMinuteAgo))),
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.phoneE164, phoneE164), gt(mitraOtpRequests.createdAt, oneHourAgo))),
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.phoneE164, phoneE164), gt(mitraOtpRequests.createdAt, oneDayAgo))),
        db.select({ value: count() }).from(mitraOtpRequests).where(and(eq(mitraOtpRequests.ip, ip), gt(mitraOtpRequests.createdAt, oneHourAgo))),
    ]);

    if ((recentPhone?.value || 0) >= 1 || (hourPhone?.value || 0) >= 5 || (dayPhone?.value || 0) >= 10 || (hourIp?.value || 0) >= 15) {
        return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 429 });
    }

    const whitelist = await findMatchingWhitelist(phoneE164, {
        id: outlet.id,
        territoryId: outlet.territoryId,
    });

    if (!whitelist) {
        await writeWhitelistUsage({
            phoneE164,
            outletId: outlet.id,
            action: "OTP_REJECTED",
            ip,
        });
        return NextResponse.json({ message: GENERIC_MESSAGE });
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
        expiresAt: addMinutes(now, 5),
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
        expires: "5 menit",
    });

    if (!sent.ok) {
        // Balasan ke pengunjung tetap generik agar tidak membocorkan status nomor,
        // tetapi kegagalannya dicatat supaya admin bisa menelusurinya.
        console.error("[OTP] Gagal mengirim OTP via WAHA:", sent.error);
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
}
