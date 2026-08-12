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

/** Template bawaan konfirmasi pengajuan langganan IndiHome. */
export const DEFAULT_INDIHOME_TEMPLATE =
    "Halo {nama}, pengajuan IndiHome {paket} untuk {lokasi} sudah kami terima. " +
    "Nomor referensi: {referensi}. Tim kami akan menghubungi Anda untuk pengecekan jaringan.";

/** Template bawaan notifikasi kunjungan salesforce ke group WhatsApp. */
export const DEFAULT_VISIT_TEMPLATE =
    "*Semangattt pagiii..*\n" +
    "Berikut update visit abkciraya.cloud/mitra\n\n" +
    "Salesforce : {salesforce}\n" +
    "ID Digipos : {digipos}\n" +
    "Nama Outlet : {outlet}\n" +
    "Keterangan : Edit long-lat jika terjadi perubahan longlat";

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
        return settings.wa_otp_template?.trim() || DEFAULT_OTP_TEMPLATE;
    } catch {
        return DEFAULT_OTP_TEMPLATE;
    }
}

export async function getIndihomeTemplate(): Promise<string> {
    try {
        const settings = await readSettings();
        return settings.wa_indihome_template?.trim() || DEFAULT_INDIHOME_TEMPLATE;
    } catch {
        return DEFAULT_INDIHOME_TEMPLATE;
    }
}

export interface VisitNotifyConfig {
    enabled: boolean;
    /** chatId group WhatsApp, mis. 120363044814127701@g.us. */
    chatId: string;
    template: string;
}

export async function getVisitNotifyConfig(): Promise<VisitNotifyConfig> {
    let settings: Record<string, string> = {};
    try {
        settings = await readSettings();
    } catch (error) {
        console.error("[WAHA] Gagal membaca pengaturan notifikasi kunjungan:", error);
    }

    const chatId = (settings.wa_visit_group_id || "").trim();

    return {
        // Tanpa chatId tidak ada tujuan kirim, jadi saklar "aktif" saja tidak cukup.
        enabled: settings.wa_visit_enabled === "1" && Boolean(chatId),
        chatId,
        template: settings.wa_visit_template?.trim() || DEFAULT_VISIT_TEMPLATE,
    };
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
 *
 * Nilai yang SUDAH berbentuk chatId dilewatkan apa adanya. Tanpa ini, id group
 * (120363...@g.us) akan kehilangan sufiksnya saat non-digit dibuang lalu dipasangi
 * "@c.us", sehingga pesan group terkirim ke nomor perorangan yang tidak ada.
 */
function formatWahaChatId(tujuan: string): string {
    const trimmed = tujuan.trim();
    if (trimmed.includes("@")) return trimmed;

    let clean = trimmed.replace(/\D/g, "");
    if (clean.startsWith("0")) clean = "62" + clean.substring(1);
    return `${clean}@c.us`;
}

const MIMETYPE_GAMBAR: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
};

function mimetypeDariUrl(url: string): string {
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
    return MIMETYPE_GAMBAR[ext] || "image/jpeg";
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
                chatId: formatWahaChatId(to),
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

/**
 * Kirim satu gambar berikut caption lewat endpoint /api/sendImage.
 *
 * WAHA yang MENGUNDUH gambarnya sendiri dari `imageUrl`, jadi URL-nya wajib absolut dan
 * bisa dijangkau dari server WAHA -- bukan path relatif seperti yang disimpan di database.
 * Endpoint diturunkan dari origin setting `wa_gw_endpoint` (yang menunjuk ke /api/sendText),
 * supaya admin tidak perlu mengisi dua alamat yang harus selalu cocok.
 */
export async function sendWhatsAppImage(
    to: string,
    imageUrl: string,
    caption: string,
    filename = "visit.jpg",
): Promise<WahaSendResult> {
    if (!to) return { ok: false, error: "Tujuan kosong" };
    if (!/^https?:\/\//i.test(imageUrl)) {
        return { ok: false, error: "URL gambar harus absolut agar bisa diunduh WAHA" };
    }

    const config = await getWahaConfig();
    if (!config.configured) {
        return { ok: false, error: "Endpoint WAHA belum diisi di Pengaturan" };
    }

    const origin = wahaOrigin(config.endpoint);
    if (!origin) return { ok: false, error: "Endpoint WAHA bukan URL yang valid" };

    try {
        const response = await fetch(`${origin}/api/sendImage`, {
            method: "POST",
            headers: authHeaders(config.token),
            body: JSON.stringify({
                chatId: formatWahaChatId(to),
                file: { mimetype: mimetypeDariUrl(imageUrl), filename, url: imageUrl },
                reply_to: null,
                caption,
                session: config.session,
            }),
            // Lebih longgar daripada sendText: WAHA harus mengunduh gambarnya lebih dulu.
            signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "");
            console.error(`[WAHA] Gagal kirim gambar ke ${to}. Status ${response.status}`, body.slice(0, 300));
            return {
                ok: false,
                httpStatus: response.status,
                error: `WAHA menolak pengiriman gambar (HTTP ${response.status})`,
            };
        }

        return { ok: true, httpStatus: response.status };
    } catch (error) {
        const reason = error instanceof Error ? (error.message || error.name) : String(error);
        console.error("[WAHA] Exception saat kirim gambar:", reason);
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
