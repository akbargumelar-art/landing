#!/usr/bin/env node
/**
 * Menandai migrasi lama sebagai "sudah diterapkan" pada database yang skemanya
 * dibangun lewat `drizzle-kit push`.
 *
 * MASALAH YANG DISELESAIKAN
 * Database produksi tidak punya tabel `__drizzle_migrations`, karena skemanya lahir dari
 * `drizzle-kit push` yang memang tidak mencatat apa pun. Menjalankan `npm run db:migrate`
 * apa adanya membuat drizzle mengira BELUM ADA migrasi yang jalan, lalu mencoba 0000 dari
 * awal -- CREATE TABLE untuk tabel yang sudah ada, dan gagal duplicate.
 *
 * CARA KERJA
 * Drizzle memutuskan apa yang dilewati hanya dari satu baris TERBARU:
 *     select id, hash, created_at from __drizzle_migrations order by created_at desc limit 1
 * lalu menjalankan setiap migrasi yang `folderMillis`-nya LEBIH BESAR dari `created_at` itu.
 * Jadi menuliskan satu baris per migrasi lama sudah cukup untuk membuatnya dilewati.
 * Hash dihitung sama seperti drizzle (sha256 atas isi berkas) supaya tabelnya jujur,
 * walaupun drizzle sendiri tidak pernah membaca kolom itu untuk keputusan melewati.
 *
 * YANG TIDAK DILAKUKAN SKRIP INI
 * Ia TIDAK menjalankan backfill data apa pun. `push` hanya menyamakan bentuk skema, jadi
 * INSERT/UPDATE di dalam migrasi lama tetap belum pernah jalan. Jalankan
 * `scripts/cek-produksi.sql` untuk melihat backfill mana yang masih kosong.
 *
 * PEMAKAIAN
 *   node scripts/baseline-drizzle-migrations.mjs --sampai 0008 --dry-run
 *   node scripts/baseline-drizzle-migrations.mjs --sampai 0008
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const AKAR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function muatDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    try {
        const env = readFileSync(path.join(AKAR, ".env"), "utf8");
        const baris = env.split(/\r?\n/).find((r) => r.startsWith("DATABASE_URL="));
        if (baris) return baris.slice("DATABASE_URL=".length).trim();
    } catch { /* lanjut */ }
    return null;
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const sampaiIdx = argv.indexOf("--sampai");
const sampai = sampaiIdx >= 0 ? argv[sampaiIdx + 1] : null;

if (!sampai) {
    console.error("Wajib: --sampai <tag>, misalnya --sampai 0008");
    console.error("Artinya: tandai seluruh migrasi SAMPAI DAN TERMASUK tag itu sebagai sudah diterapkan.");
    process.exit(2);
}

const url = muatDatabaseUrl();
if (!url) {
    console.error("DATABASE_URL tidak ditemukan (environment maupun .env).");
    process.exit(2);
}

const journal = JSON.parse(readFileSync(path.join(AKAR, "drizzle", "meta", "_journal.json"), "utf8"));
const entri = journal.entries.sort((a, b) => a.when - b.when);

const batas = entri.findIndex((e) => e.tag.startsWith(sampai));
if (batas < 0) {
    console.error(`Tidak ada migrasi dengan awalan "${sampai}" di journal.`);
    console.error(`Tersedia: ${entri.map((e) => e.tag).join(", ")}`);
    process.exit(2);
}

const akanDitandai = entri.slice(0, batas + 1);
const akanDijalankan = entri.slice(batas + 1);

console.log(`Akan DITANDAI sudah diterapkan (${akanDitandai.length}):`);
for (const e of akanDitandai) console.log(`  ${e.tag}`);
console.log(`\nAkan tetap DIJALANKAN oleh db:migrate berikutnya (${akanDijalankan.length}):`);
for (const e of akanDijalankan) console.log(`  ${e.tag}`);
if (akanDijalankan.length === 0) console.log("  (tidak ada)");

const conn = await mysql.createConnection({ uri: url });

try {
    // Yang menentukan adalah ada tidaknya BARIS, bukan ada tidaknya tabel. `db:migrate`
    // yang gagal di tengah tetap meninggalkan tabel ini dalam keadaan KOSONG -- dan itu
    // justru keadaan yang paling butuh baseline. Memeriksa keberadaan tabel saja membuat
    // skrip ini menolak bekerja tepat ketika ia paling dibutuhkan.
    const [[adaTabel]] = await conn.query(
        `SELECT COUNT(*) AS c FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = '__drizzle_migrations'`
    );

    if (adaTabel.c > 0) {
        const [baris] = await conn.query(
            "SELECT created_at FROM `__drizzle_migrations` ORDER BY created_at DESC LIMIT 1"
        );
        if (baris.length > 0) {
            console.log(`\n__drizzle_migrations sudah BERISI, baris terbaru created_at=${baris[0].created_at}.`);
            console.log("Database ini sudah punya riwayat migrasi -- baseline TIDAK diperlukan dan dibatalkan.");
            process.exit(1);
        }
        console.log("\n__drizzle_migrations ada tetapi KOSONG (sisa db:migrate yang gagal). Baseline dilanjutkan.");
    }

    if (dryRun) {
        console.log("\n--dry-run: tidak ada yang ditulis.");
        process.exit(0);
    }

    // Bentuk tabel harus sama persis dengan yang dibuat drizzle sendiri.
    await conn.query(
        "CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (" +
        " id SERIAL PRIMARY KEY, hash text not null, created_at bigint)"
    );

    for (const e of akanDitandai) {
        const isi = readFileSync(path.join(AKAR, "drizzle", `${e.tag}.sql`), "utf8");
        const hash = createHash("sha256").update(isi).digest("hex");
        await conn.query(
            "INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)",
            [hash, e.when]
        );
    }

    const [cek] = await conn.query(
        "SELECT COUNT(*) AS jumlah, MAX(created_at) AS terbaru FROM `__drizzle_migrations`"
    );
    console.log(`\nSelesai. ${cek[0].jumlah} baris ditulis, created_at terbaru = ${cek[0].terbaru}.`);
    console.log("Sekarang `npm run db:migrate` hanya akan menjalankan migrasi setelahnya.");
} finally {
    await conn.end();
}
