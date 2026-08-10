import { and, asc, eq, lt, lte } from "drizzle-orm";
import { v4 as uuid } from "uuid";

import { db } from "@/db";
import { mitraOutlets, mitraSalesforces, mitraVisitNotifications } from "@/db/schema";
import { MITRA_PHOTO_SLOTS } from "@/lib/mitra-outlet-photos";
import { getVisitNotifyConfig, renderTemplate, sendWhatsAppImage, sendWhatsAppMessage } from "@/lib/whatsapp";

/**
 * Notifikasi kunjungan salesforce ke group WhatsApp.
 *
 * Tiga aturan yang membentuk seluruh modul ini:
 *
 * 1. SATU KUNJUNGAN = SATU PESAN. Foto diunggah satu per satu, jadi kalau route unggah
 *    langsung mengirim WA, satu kunjungan menghasilkan empat pesan. Unggahan dikumpulkan
 *    per sesi OTP dan baru dikirim setelah JEDA_HENING_MS berlalu tanpa unggahan baru.
 *    Hanya foto yang memicu notifikasi -- perubahan long-lat cukup masuk riwayat edit.
 *
 * 2. YANG DIKIRIM ADALAH FOTO TAMPAK DEPAN. WhatsApp hanya memuat satu gambar per pesan,
 *    dan tampak depan adalah satu-satunya slot yang bisa dinilai sekilas oleh pembaca group.
 *    Diambil dari foto kunjungan INI, bukan foto tersimpan dari kunjungan sebelumnya.
 *
 * 3. ANTAR PESAN DIBERI JEDA ACAK 30-120 DETIK. Beberapa outlet bisa selesai berbarengan;
 *    mengirim beruntun tanpa jeda adalah pola yang membuat nomor WhatsApp diblokir.
 *
 * Antreannya hidup di tabel, bukan di memori: pekerja di bawah hanyalah penggerak, dan
 * kalau prosesnya mati di tengah jalan, baris PENDING masih ada untuk dikerjakan nanti.
 */

const JEDA_HENING_MS = 2 * 60 * 1000;
const JEDA_KIRIM_MIN_MS = 30_000;
const JEDA_KIRIM_MAKS_MS = 120_000;

/**
 * Slot yang dikirim ke group. Diturunkan dari penanda `utama` di MITRA_PHOTO_SLOTS, bukan
 * ditulis "depan" langsung di sini, supaya kalau suatu saat slot utamanya dipindah, yang
 * terkirim ikut pindah alih-alih diam-diam menunjuk slot yang sudah bukan foto utama.
 */
const SLOT_DIKIRIM = MITRA_PHOTO_SLOTS.find((slot) => slot.utama)?.key ?? "depan";

/** Selang periksa saat masih ada antrean tetapi belum ada yang melewati jeda hening. */
const SELANG_PERIKSA_MS = 15_000;

const MAKS_PERCOBAAN = 3;

/**
 * Kunjungan yang menggantung lebih lama dari ini tidak dikirim lagi. Tanpa batas ini,
 * WAHA yang mati semalaman akan memuntahkan puluhan pesan basi begitu hidup kembali.
 */
const KEDALUWARSA_MS = 12 * 60 * 60 * 1000;

export interface FotoKunjungan {
    slot: string;
    label: string;
    url: string;
}

function tidur(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function jedaAcak() {
    return JEDA_KIRIM_MIN_MS + Math.floor(Math.random() * (JEDA_KIRIM_MAKS_MS - JEDA_KIRIM_MIN_MS + 1));
}

/**
 * Path unggahan disimpan relatif (/api/public/uploads/...), sedangkan WAHA mengunduh
 * gambarnya dari servernya sendiri dan tidak tahu host aplikasi ini.
 */
function urlAbsolut(path: string): string | null {
    if (/^https?:\/\//i.test(path)) return path;

    const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || "").trim().replace(/\/+$/, "");
    if (!base) return null;

    return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

// ---------------------------------------------------------------------------
// Perekam: dipanggil dari route yang mengubah data outlet
// ---------------------------------------------------------------------------

interface AktivitasKunjungan {
    outletId: string;
    /** id sesi OTP; inilah kunci "satu kunjungan". */
    sessionId: string;
    actorPhone?: string | null;
    foto: FotoKunjungan;
}

/**
 * Mencatat satu aktivitas kunjungan dan menyalakan pekerja pengirim.
 *
 * TIDAK PERNAH melempar: notifikasi group adalah efek samping, dan kegagalannya tidak
 * boleh membuat unggahan foto yang sudah tersimpan dilaporkan gagal ke salesforce.
 */
export async function catatAktivitasKunjungan(input: AktivitasKunjungan): Promise<void> {
    try {
        const { enabled } = await getVisitNotifyConfig();
        if (!enabled) return;

        const sekarang = new Date();

        const [adaBaris] = await db
            .select()
            .from(mitraVisitNotifications)
            .where(eq(mitraVisitNotifications.sessionId, input.sessionId))
            .limit(1);

        if (!adaBaris) {
            await db.insert(mitraVisitNotifications).values({
                id: uuid(),
                outletId: input.outletId,
                sessionId: input.sessionId,
                actorPhone: input.actorPhone || null,
                photosJson: [input.foto],
                status: "PENDING",
                lastActivityAt: sekarang,
                createdAt: sekarang,
            });
        } else if (adaBaris.status === "PENDING") {
            // Aturan 1: aktivitas susulan menambah isi pesan dan menggeser jeda hening,
            // bukan membuat pesan kedua.
            const foto = adaBaris.photosJson || [];

            await db
                .update(mitraVisitNotifications)
                .set({
                    // Slot yang sama diunggah ulang menimpa entri lamanya, jadi yang terkirim
                    // adalah percobaan terakhir salesforce -- bukan jepretan pertama yang
                    // barangkali justru diulang karena hasilnya buram.
                    photosJson: [...foto.filter((f) => f.slot !== input.foto.slot), input.foto],
                    lastActivityAt: sekarang,
                })
                .where(eq(mitraVisitNotifications.id, adaBaris.id));
        }
        // Status SENDING/SENT/FAILED sengaja dibiarkan: pesan untuk kunjungan itu sudah
        // (atau sedang) dikirim, dan aturan 1 melarang pesan kedua untuk sesi yang sama.

        jalankanPengirim();
    } catch (error) {
        console.error("[Visit WA] Gagal mencatat aktivitas kunjungan:", error);
    }
}

// ---------------------------------------------------------------------------
// Pekerja pengirim
// ---------------------------------------------------------------------------

/**
 * Pekerja disimpan di globalThis, bukan variabel modul, supaya hot-reload saat
 * pengembangan tidak memunculkan pekerja kedua yang mengirim pesan kembar.
 *
 * `periksaUlang` menutup celah balapan: pekerja bisa memutuskan antrean kosong tepat
 * sebelum aktivitas baru tersimpan, lalu berhenti dan meninggalkan baris itu menggantung
 * sampai ada unggahan berikutnya. Penanda ini membuatnya memeriksa sekali lagi.
 */
const state = globalThis as unknown as {
    __mitraVisitWorkerAktif?: boolean;
    __mitraVisitPeriksaUlang?: boolean;
};

/** Menyalakan pekerja bila belum berjalan. Selalu kembali seketika. */
export function jalankanPengirim(): void {
    if (state.__mitraVisitWorkerAktif) {
        state.__mitraVisitPeriksaUlang = true;
        return;
    }

    state.__mitraVisitWorkerAktif = true;
    state.__mitraVisitPeriksaUlang = false;

    void pekerja()
        .catch((error) => console.error("[Visit WA] Pekerja berhenti karena error:", error))
        .finally(() => {
            state.__mitraVisitWorkerAktif = false;

            // Aktivitas yang masuk selama pekerja berhenti tidak punya siapa pun yang
            // menyalakannya lagi -- di sinilah ia dinyalakan.
            if (state.__mitraVisitPeriksaUlang) {
                state.__mitraVisitPeriksaUlang = false;
                jalankanPengirim();
            }
        });
}

async function pekerja(): Promise<void> {
    for (;;) {
        await bersihkanKedaluwarsa();

        const baris = await ambilYangSiap();

        if (!baris) {
            // Masih ada antrean yang jeda heningnya belum habis: tunggu, jangan matikan
            // pekerja -- kalau tidak, kunjungan itu baru terkirim saat ada unggahan lain.
            const tersisa = await hitungPending();
            if (tersisa === 0) {
                if (!state.__mitraVisitPeriksaUlang) return;
                state.__mitraVisitPeriksaUlang = false;
                continue;
            }

            await tidur(SELANG_PERIKSA_MS);
            continue;
        }

        await kirimSatu(baris);

        // Aturan 3: jeda berlaku SETELAH kirim, jadi pesan berikutnya tidak menempel.
        if (await hitungPending()) {
            await tidur(jedaAcak());
        }
    }
}

type BarisNotifikasi = typeof mitraVisitNotifications.$inferSelect;

async function ambilYangSiap(): Promise<BarisNotifikasi | null> {
    const batas = new Date(Date.now() - JEDA_HENING_MS);

    const [baris] = await db
        .select()
        .from(mitraVisitNotifications)
        .where(and(
            eq(mitraVisitNotifications.status, "PENDING"),
            lte(mitraVisitNotifications.lastActivityAt, batas),
        ))
        .orderBy(asc(mitraVisitNotifications.lastActivityAt))
        .limit(1);

    if (!baris) return null;

    // Ditandai SENDING lebih dulu supaya baris yang sama tidak terambil dua kali bila
    // suatu saat aplikasi dijalankan lebih dari satu proses.
    await db
        .update(mitraVisitNotifications)
        .set({ status: "SENDING", attempts: baris.attempts + 1 })
        .where(and(
            eq(mitraVisitNotifications.id, baris.id),
            eq(mitraVisitNotifications.status, "PENDING"),
        ));

    return baris;
}

async function hitungPending(): Promise<number> {
    const rows = await db
        .select({ id: mitraVisitNotifications.id })
        .from(mitraVisitNotifications)
        .where(eq(mitraVisitNotifications.status, "PENDING"))
        .limit(1);

    return rows.length;
}

async function bersihkanKedaluwarsa(): Promise<void> {
    await db
        .update(mitraVisitNotifications)
        .set({ status: "FAILED", lastError: "Kedaluwarsa sebelum sempat terkirim" })
        .where(and(
            eq(mitraVisitNotifications.status, "PENDING"),
            lt(mitraVisitNotifications.lastActivityAt, new Date(Date.now() - KEDALUWARSA_MS)),
        ));
}

async function kirimSatu(baris: BarisNotifikasi): Promise<void> {
    try {
        const config = await getVisitNotifyConfig();
        if (!config.enabled) {
            await tandai(baris, false, "Notifikasi kunjungan dimatikan di Pengaturan");
            return;
        }

        const [outlet] = await db
            .select({
                name: mitraOutlets.name,
                outletCode: mitraOutlets.outletCode,
                tap: mitraOutlets.tap,
                publicToken: mitraOutlets.publicToken,
                salesforce: mitraSalesforces.name,
            })
            .from(mitraOutlets)
            .leftJoin(mitraSalesforces, eq(mitraOutlets.salesforceId, mitraSalesforces.id))
            .where(eq(mitraOutlets.id, baris.outletId))
            .limit(1);

        if (!outlet) {
            await tandai(baris, false, "Outlet sudah tidak ada");
            return;
        }

        const foto = baris.photosJson || [];

        const pesan = renderTemplate(config.template, {
            salesforce: outlet.salesforce || "-",
            digipos: outlet.outletCode,
            outlet: outlet.name,
            tap: outlet.tap || "-",
            perubahan: `${foto.length} foto diperbarui`,
            tanggal: new Intl.DateTimeFormat("id-ID", {
                dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta",
            }).format(baris.lastActivityAt),
            link: urlAbsolut(`/mitra/o/${outlet.publicToken}`) || "",
        });

        // Aturan 2: tampak depan yang dikirim. Kunjungan bisa saja hanya memperbarui etalase
        // atau POP tanpa memotret ulang muka outlet; dalam hal itu foto pertama kunjungan ini
        // yang dipakai, supaya pesannya tetap membawa bukti kunjungan alih-alih kosong.
        const terpilih = foto.find((f) => f.slot === SLOT_DIKIRIM) || foto[0] || null;
        const gambar = terpilih ? urlAbsolut(terpilih.url) : null;

        if (terpilih && !gambar) {
            console.warn("[Visit WA] NEXT_PUBLIC_BASE_URL belum diisi, pesan dikirim tanpa foto.");
        }

        const hasil = gambar
            ? await sendWhatsAppImage(config.chatId, gambar, pesan, `${terpilih!.slot}.jpg`)
            // Hanya terjadi bila URL absolutnya tidak bisa dibentuk: pesannya tetap dikirim
            // supaya kunjungannya tercatat di group, sekadar tanpa gambar.
            : await sendWhatsAppMessage(config.chatId, pesan);

        await tandai(baris, hasil.ok, hasil.error);
    } catch (error) {
        const alasan = error instanceof Error ? (error.message || error.name) : String(error);
        console.error("[Visit WA] Gagal mengirim notifikasi kunjungan:", alasan);
        await tandai(baris, false, alasan).catch(() => undefined);
    }
}

async function tandai(baris: BarisNotifikasi, sukses: boolean, error?: string): Promise<void> {
    // Percobaan sudah dinaikkan saat baris diambil, jadi nilai di sini adalah jumlah
    // percobaan yang benar-benar sudah dilakukan.
    const percobaan = baris.attempts + 1;

    // Dikembalikan ke PENDING agar dicoba lagi pada putaran berikutnya, sampai batasnya.
    const status = sukses ? "SENT" : percobaan >= MAKS_PERCOBAAN ? "FAILED" : "PENDING";

    await db
        .update(mitraVisitNotifications)
        .set({
            status,
            sentAt: sukses ? new Date() : null,
            lastError: sukses ? null : (error || "Gagal tanpa keterangan").slice(0, 500),
        })
        .where(eq(mitraVisitNotifications.id, baris.id));
}
