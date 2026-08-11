import { createHash, randomBytes, randomInt } from "crypto";
import { NextResponse } from "next/server";

export const MITRA_DETAIL_SESSION_COOKIE = "mitra_detail_session";
/**
 * Sesi program dipisah dari sesi detail outlet: keduanya memberi akses ke hal berbeda,
 * jadi membuka satu tidak boleh diam-diam membuka yang lain.
 */
export const MITRA_PROGRAM_SESSION_COOKIE = "mitra_program_session";

/**
 * Kode OTP berlaku 5 menit untuk dimasukkan ke web.
 *
 * Sesi hasil verifikasi berlaku 30 hari. Sebelumnya diisi sepuluh tahun agar "praktis tidak
 * pernah kedaluwarsa", tetapi sesi itu adalah kunci baca ke data pribadi outlet -- dan kunci
 * yang tidak pernah kedaluwarsa ikut berpindah tangan bersama nomor yang didaur ulang
 * operator. Tiga puluh hari cukup panjang untuk pemakaian rutin mingguan, dan cukup pendek
 * untuk membuat akses yang telantar berhenti dengan sendirinya.
 */
export const MITRA_OTP_TTL_MINUTES = 5;
export const MITRA_DETAIL_SESSION_TTL_MINUTES = 60 * 24 * 30;

export function normalizePhoneE164(phone: string): string {
    const clean = phone.replace(/[^\d+]/g, "").trim();
    if (!clean) return "";

    if (clean.startsWith("+")) {
        return `+${clean.slice(1).replace(/\D/g, "")}`;
    }

    const digits = clean.replace(/\D/g, "");
    if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
    if (digits.startsWith("62")) return `+${digits}`;
    return `+${digits}`;
}

export function phoneForDisplay(phone: string): string {
    const normalized = normalizePhoneE164(phone);
    if (!normalized) return "";
    return normalized.replace(/^\+62/, "0");
}

export function maskPhone(phone: string): string {
    const display = phoneForDisplay(phone);
    if (display.length <= 7) return `${display.slice(0, 4)}***`;
    return `${display.slice(0, 4)}*****${display.slice(-3)}`;
}

export function generatePublicToken(): string {
    return randomBytes(18).toString("base64url");
}

export function generateSessionToken(): string {
    return randomBytes(32).toString("base64url");
}

export function generateOtpCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashValue(value: string, salt = ""): string {
    return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export function createOtpHash(code: string) {
    const salt = randomBytes(16).toString("hex");
    return { salt, hash: hashValue(code, salt) };
}

export function verifyOtpHash(code: string, salt: string, hash: string): boolean {
    return hashValue(code, salt) === hash;
}

export function hashSessionToken(token: string): string {
    return hashValue(token, process.env.BETTER_AUTH_SECRET || "mitra-detail-session");
}

export function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
}

export function isFuture(date: Date | string): boolean {
    return new Date(date).getTime() > Date.now();
}

export function getClientIp(request: Request): string {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        ""
    );
}

export function getSiteBaseUrl(request?: Request): string {
    const configured =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.BETTER_AUTH_URL ||
        "";

    if (configured) return configured.replace(/\/$/, "");
    if (request) return new URL(request.url).origin;
    return "http://localhost:3000";
}

export function buildOutletPublicUrl(publicToken: string, request?: Request): string {
    return `${getSiteBaseUrl(request)}/mitra/o/${publicToken}`;
}

export function slugify(input: string): string {
    const slug = input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    return slug || `program-${Date.now()}`;
}

export function parseNumber(input: unknown): number {
    if (typeof input === "number") return Number.isFinite(input) ? input : 0;
    if (typeof input !== "string") return 0;
    const normalized = input.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function toDecimalString(input: unknown): string {
    return parseNumber(input).toFixed(2);
}

export function formatNumberId(input: string | number | null | undefined): string {
    const value = Number(input ?? 0);
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

export function formatDateId(input: string | Date): string {
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(input));
}

export function jsonError(message: string, status = 400): NextResponse {
    return NextResponse.json({ error: message }, { status });
}

export function safeJsonParse<T>(input: string | null | undefined, fallback: T): T {
    if (!input) return fallback;
    try {
        return JSON.parse(input) as T;
    } catch {
        return fallback;
    }
}
