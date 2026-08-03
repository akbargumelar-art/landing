import { db } from "@/db";
import { siteSettings } from "@/db/schema";

/**
 * Konfigurasi koneksi WAHA bersifat GENERAL untuk seluruh aplikasi (OTP Portal Mitra,
 * notifikasi undian, dan fitur lain nanti). Isi pesannya TIDAK di sini: tiap fitur membawa
 * templatenya sendiri, karena placeholder-nya berbeda.
 *
 * Sebelumnya keduanya dicampur dalam satu setting `wa_gw_template`, sehingga notifikasi
 * undian ikut memakai template OTP (lengkap dengan {otp} yang tidak pernah terisi).
 */

export interface WahaConfig {
    endpoint: string;
    token: string;
    session: string;
    configured: boolean;
}

export interface WahaSendResult {
    ok: boolean;
    /** Alasan singkat yang aman ditampilkan ke admin. */
    error?: string;
    httpStatus?: number;
}

/** Template bawaan OTP Portal Mitra Outlet bila admin belum mengisinya. */
export const DEFAULT_OTP_TEMPLATE =
    "Kode OTP Portal Mitra Outlet {outlet}: {otp}. Berlaku {expires}.";

/** Template bawaan notifikasi pendaftaran program undian. */
export const DEFAULT_UNDIAN_TEMPLATE =
    "Halo {nama}, pendaftaran Anda untuk {program} sudah kami terima. Terima kasih.";

async function readSettings(): Promise<Record<string, string>> {
    // Baca seluruh baris: tipe baris diturunkan dari nama key di UI admin, jadi memfilter
    // berdasarkan `type` pernah membuat field WAHA hilang diam-diam.
    const rows = await db
        .select({ key: siteSettings.key, value: siteSettings.value })
        .from(siteSettings);

    return rows.reduce((acc: Record<string, string>, row) => {
        acc[row.key] = row.value;
        return acc;
    }, {});
}

export async function getWahaConfig(): Promise<WahaConfig> {
    let settings: Record<string, string> = {};
    try {
        settings = await readSettings();
    } catch (error) {
        console.error("[WAHA] Gagal membaca pengaturan:", error);
    }

    const endpoint = (settings.wa_gw_endpoint || process.env.WAHA_BASE_URL || "").trim();
    const token = (settings.wa_gw_token || process.env.WAHA_API_KEY || "").trim();
    const session = (settings.wa_gw_session || process.env.WAHA_SESSION || "default").trim();

    return { endpoint, token, session, configured: Boolean(endpoint) };
}

export async function getOtpTemplate(): Promise<string> {
    try {
        const settings = await readSettings();
        return settings.wa_otp_template?.trim() || settings.wa_gw_template?.trim() || DEFAULT_OTP_TEMPLATE;
    } catch {
        return DEFAULT_OTP_TEMPLATE;
    }
}

/** Ganti {placeholder} dengan nilai dari `data`; placeholder tanpa nilai dikosongkan. */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
    let message = template;
    for (const [key, value] of Object.entries(data)) {
        const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        message = message.replace(new RegExp(`\\{${safeKey}\\}`, "gi"), String(value ?? ""));
    }
    // Alias yang umum dipakai admin di template berbahasa Indonesia.
    if (data.name !== undefined) message = message.replace(/\{nama(\s+lengkap)?\}/gi, String(data.name ?? ""));
    if (data.programName !== undefined) message = message.replace(/\{program\}/gi, String(data.programName ?? ""));
    return message;
}

/**
 * 0812... -> 62812...@c.us
 */
function formatWahaPhone(phone: string): string {
    let clean = phone.replace(/\D/g, "");
    if (clean.startsWith("0")) clean = "62" + clean.substring(1);
    return clean.endsWith("@c.us") ? clean : `${clean}@c.us`;
}

function wahaOrigin(endpoint: string): string | null {
    try {
        return new URL(endpoint).origin;
    } catch {
        return null;
    }
}

function authHeaders(token: string): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
    };
    if (token) {
        headers["X-Api-Key"] = token;
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Kirim satu pesan. Mengembalikan hasil alih-alih menelan error, supaya pemanggil bisa
 * mencatat atau menampilkannya. Tidak pernah melempar.
 */
export async function sendWhatsAppMessage(to: string, text: string): Promise<WahaSendResult> {
    if (!to) return { ok: false, error: "Nomor tujuan kosong" };
    if (!text.trim()) return { ok: false, error: "Isi pesan kosong" };

    const config = await getWahaConfig();
    if (!config.configured) {
        return { ok: false, error: "Endpoint WAHA belum diisi di Pengaturan" };
    }

    try {
        const response = await fetch(config.endpoint, {
            method: "POST",
            headers: authHeaders(config.token),
            body: JSON.stringify({
                chatId: formatWahaPhone(to),
                text,
                session: config.session,
            }),
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "");
            console.error(`[WAHA] Gagal kirim ke ${to}. Status ${response.status}`, body.slice(0, 300));
            return {
                ok: false,
                httpStatus: response.status,
                error: `WAHA menolak permintaan (HTTP ${response.status})`,
            };
        }

        return { ok: true, httpStatus: response.status };
    } catch (error) {
        const reason = error instanceof Error ? (error.message || error.name) : String(error);
        console.error("[WAHA] Exception saat kirim:", reason);
        return { ok: false, error: `Tidak dapat menghubungi WAHA: ${reason}` };
    }
}

/** Kirim memakai template; dipakai fitur yang menyimpan templatenya sendiri. */
export async function sendTemplatedWhatsApp(
    to: string,
    template: string,
    data: Record<string, unknown>,
): Promise<WahaSendResult> {
    return sendWhatsAppMessage(to, renderTemplate(template, data));
}

export interface WahaDiagnostics {
    configured: boolean;
    endpoint: string;
    session: string;
    hasToken: boolean;
    reachable: boolean;
    sessionStatus?: string;
    error?: string;
}

/**
 * Diagnosa koneksi tanpa mengirim pesan. Dipakai tombol "Tes Koneksi" di Pengaturan supaya
 * admin tahu penyebabnya, bukan sekadar "pesan tidak masuk".
 */
export async function testWahaConnection(): Promise<WahaDiagnostics> {
    const config = await getWahaConfig();
    const base: WahaDiagnostics = {
        configured: config.configured,
        endpoint: config.endpoint,
        session: config.session,
        hasToken: Boolean(config.token),
        reachable: false,
    };

    if (!config.configured) {
        return { ...base, error: "Endpoint WAHA belum diisi di Pengaturan." };
    }

    const origin = wahaOrigin(config.endpoint);
    if (!origin) {
        return { ...base, error: "Endpoint WAHA bukan URL yang valid." };
    }

    try {
        const response = await fetch(`${origin}/api/sessions/${encodeURIComponent(config.session)}`, {
            headers: authHeaders(config.token),
            signal: AbortSignal.timeout(8_000),
            cache: "no-store",
        });

        if (response.status === 401 || response.status === 403) {
            return { ...base, reachable: true, error: "Server WAHA terhubung, tetapi API key ditolak." };
        }
        if (response.status === 404) {
            return {
                ...base,
                reachable: true,
                error: `Server WAHA terhubung, tetapi session "${config.session}" tidak ditemukan.`,
            };
        }
        if (!response.ok) {
            return { ...base, reachable: true, error: `Server WAHA membalas HTTP ${response.status}.` };
        }

        const data = await response.json().catch(() => null);
        const status = typeof data?.status === "string" ? data.status : undefined;

        // WAHA mengembalikan WORKING bila sesi sudah tersambung ke WhatsApp.
        if (status && status.toUpperCase() !== "WORKING") {
            return {
                ...base,
                reachable: true,
                sessionStatus: status,
                error: `Session "${config.session}" berstatus ${status}, belum siap mengirim pesan.`,
            };
        }

        return { ...base, reachable: true, sessionStatus: status || "WORKING" };
    } catch (error) {
        const reason = error instanceof Error ? (error.message || error.name) : String(error);
        return { ...base, error: `Tidak dapat menghubungi server WAHA: ${reason}` };
    }
}
