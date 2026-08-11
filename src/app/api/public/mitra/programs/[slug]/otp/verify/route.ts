import { NextResponse } from "next/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraDetailSessions, mitraOtpRequests, mitraPrograms } from "@/db/schema";
import { writeWhitelistUsage } from "@/lib/mitra-data";
import {
    MITRA_DETAIL_SESSION_TTL_MINUTES,
    MITRA_PROGRAM_SESSION_COOKIE,
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
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const [program] = await db
        .select({ id: mitraPrograms.id })
        .from(mitraPrograms)
        .where(and(eq(mitraPrograms.slug, slug), eq(mitraPrograms.targetType, "SALESFORCE"), eq(mitraPrograms.isPublic, true)))
        .limit(1);

    if (!program) return NextResponse.json({ error: "Kode OTP tidak valid" }, { status: 400 });

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
        .where(and(
            eq(mitraOtpRequests.phoneE164, phoneE164),
            eq(mitraOtpRequests.programId, program.id),
            gt(mitraOtpRequests.expiresAt, new Date()),
            isNull(mitraOtpRequests.verifiedAt)
        ))
        .orderBy(desc(mitraOtpRequests.createdAt))
        .limit(1);

    // Pesan galat sengaja sama untuk kode salah, kedaluwarsa, dan percobaan habis: memberi
    // tahu bedanya hanya mempermudah menebak.
    if (!otp || otp.attempts >= 3) {
        await writeWhitelistUsage({ phoneE164, programId: program.id, action: "OTP_REJECTED", ip });
        return NextResponse.json({ error: "Kode OTP tidak valid" }, { status: 400 });
    }

    if (!verifyOtpHash(code, otp.codeSalt, otp.codeHash)) {
        await db.update(mitraOtpRequests).set({ attempts: otp.attempts + 1 }).where(eq(mitraOtpRequests.id, otp.id));
        await writeWhitelistUsage({ whitelistId: otp.whitelistId, phoneE164, programId: program.id, action: "OTP_REJECTED", ip });
        return NextResponse.json({ error: "Kode OTP tidak valid" }, { status: 400 });
    }

    const now = new Date();
    const sessionToken = generateSessionToken();

    await db.update(mitraOtpRequests).set({ verifiedAt: now }).where(eq(mitraOtpRequests.id, otp.id));
    await db.insert(mitraDetailSessions).values({
        id: uuid(),
        tokenHash: hashSessionToken(sessionToken),
        phoneE164,
        programId: program.id,
        expiresAt: addMinutes(now, MITRA_DETAIL_SESSION_TTL_MINUTES),
        createdAt: now,
    });

    await writeWhitelistUsage({ whitelistId: otp.whitelistId, phoneE164, programId: program.id, action: "OTP_VERIFIED", ip });

    const response = NextResponse.json({ verified: true });

    response.cookies.set(MITRA_PROGRAM_SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: MITRA_DETAIL_SESSION_TTL_MINUTES * 60,
        // Harus ikut terkirim ke API detail program, bukan hanya ke halamannya.
        path: "/",
    });

    return response;
}
