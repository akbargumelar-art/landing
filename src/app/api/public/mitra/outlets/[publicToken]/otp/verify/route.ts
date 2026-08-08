import { NextResponse } from "next/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraDetailSessions, mitraOtpRequests } from "@/db/schema";
import { getMitraOutletRecordByToken, writeWhitelistUsage } from "@/lib/mitra-data";
import {
    MITRA_DETAIL_SESSION_COOKIE,
    MITRA_DETAIL_SESSION_TTL_MINUTES,
    addMinutes,
    generateSessionToken,
    getClientIp,
    hashSessionToken,
    normalizePhoneE164,
    verifyOtpHash,
} from "@/lib/mitra-utils";

export const dynamic = "force-dynamic";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ publicToken: string }> }
) {
    const { publicToken } = await params;
    const outlet = await getMitraOutletRecordByToken(publicToken);

    if (!outlet) {
        return NextResponse.json({ error: "Kode OTP tidak valid" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const phoneE164 = normalizePhoneE164(String(body.phone || ""));
    const code = String(body.code || "").replace(/\D/g, "");
    const ip = getClientIp(request);

    if (!phoneE164 || code.length !== 6) {
        return NextResponse.json({ error: "Kode OTP tidak valid" }, { status: 400 });
    }

    const [otp] = await db
        .select()
        .from(mitraOtpRequests)
        .where(
            and(
                eq(mitraOtpRequests.phoneE164, phoneE164),
                eq(mitraOtpRequests.outletId, outlet.id),
                gt(mitraOtpRequests.expiresAt, new Date()),
                isNull(mitraOtpRequests.verifiedAt)
            )
        )
        .orderBy(desc(mitraOtpRequests.createdAt))
        .limit(1);

    if (!otp || otp.attempts >= 3) {
        await writeWhitelistUsage({
            phoneE164,
            outletId: outlet.id,
            action: "OTP_REJECTED",
            ip,
        });
        return NextResponse.json({ error: "Kode OTP tidak valid" }, { status: 400 });
    }

    if (!verifyOtpHash(code, otp.codeSalt, otp.codeHash)) {
        await db
            .update(mitraOtpRequests)
            .set({ attempts: otp.attempts + 1 })
            .where(eq(mitraOtpRequests.id, otp.id));

        await writeWhitelistUsage({
            whitelistId: otp.whitelistId,
            phoneE164,
            outletId: outlet.id,
            action: "OTP_REJECTED",
            ip,
        });

        return NextResponse.json({ error: "Kode OTP tidak valid" }, { status: 400 });
    }

    const now = new Date();
    const sessionToken = generateSessionToken();

    await db.update(mitraOtpRequests).set({ verifiedAt: now }).where(eq(mitraOtpRequests.id, otp.id));
    await db.insert(mitraDetailSessions).values({
        id: uuid(),
        tokenHash: hashSessionToken(sessionToken),
        phoneE164,
        outletId: outlet.id,
        expiresAt: addMinutes(now, MITRA_DETAIL_SESSION_TTL_MINUTES),
        createdAt: now,
    });

    await writeWhitelistUsage({
        whitelistId: otp.whitelistId,
        phoneE164,
        outletId: outlet.id,
        action: "OTP_VERIFIED",
        ip,
    });

    const response = NextResponse.json({
        verified: true,
        detailUrl: `/mitra/o/${publicToken}/detail`,
    });

    response.cookies.set(MITRA_DETAIL_SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        // Sesi detail sengaja tidak dibatasi waktu; yang dibatasi hanya masa berlaku
        // kode OTP. Browser tetap memangkas umur cookie ke batasnya sendiri (~400 hari),
        // dan setelah itu pengunjung tinggal minta OTP baru.
        maxAge: MITRA_DETAIL_SESSION_TTL_MINUTES * 60,
        // Cookie harus ikut terkirim ke API detail (/api/public/mitra/outlets/.../detail),
        // bukan hanya ke halaman /mitra/o/{token}. Jika path dibatasi ke halaman,
        // fetch detail langsung 401 dan UI menampilkan sesi sudah berakhir.
        path: "/",
    });

    return response;
}
