#!/usr/bin/env node
/**
 * Verifies the Fase 3 unified-program backfill (drizzle/0004_unified_program_schema.sql).
 *
 * Run AFTER applying the migration, against the same database:
 *   node scripts/verify-program-migration.mjs
 *
 * Reads DATABASE_URL from the environment (or .env). Exits non-zero if any check fails,
 * so it can gate a deploy. It only SELECTs - it never modifies data.
 */

import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

function loadDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    try {
        const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
        const line = env.split(/\r?\n/).find((row) => row.startsWith("DATABASE_URL="));
        if (line) return line.slice("DATABASE_URL=".length).trim();
    } catch {
        // fall through
    }
    return null;
}

const results = [];
function check(label, passed, detail) {
    results.push({ label, passed, detail });
}

async function main() {
    const url = loadDatabaseUrl();
    if (!url) {
        console.error("DATABASE_URL tidak ditemukan (environment maupun .env).");
        process.exit(2);
    }

    const conn = await mysql.createConnection({ uri: url });
    const count = async (sql) => {
        const [rows] = await conn.query(sql);
        return Number(rows[0].c);
    };

    // --- Programs -----------------------------------------------------------
    const mitraPrograms = await count("SELECT COUNT(*) c FROM mitra_programs");
    const migratedPerformance = await count(
        "SELECT COUNT(*) c FROM programs WHERE mode = 'PERFORMANCE'"
    );
    check(
        "Setiap mitra_programs punya baris PERFORMANCE di programs",
        mitraPrograms === migratedPerformance,
        `mitra_programs=${mitraPrograms}, programs(PERFORMANCE)=${migratedPerformance}`
    );

    const missingById = await count(`
        SELECT COUNT(*) c FROM mitra_programs mp
        LEFT JOIN programs p ON p.id = mp.id
        WHERE p.id IS NULL
    `);
    check(
        "Semua id mitra_programs terbawa (id dipertahankan untuk FK anak)",
        missingById === 0,
        `mitra_programs tanpa pasangan di programs: ${missingById}`
    );

    const modeNull = await count("SELECT COUNT(*) c FROM programs WHERE mode IS NULL");
    check("Tidak ada programs.mode kosong", modeNull === 0, `mode NULL: ${modeNull}`);

    // --- Winners ------------------------------------------------------------
    const legacyWinners = await count("SELECT COUNT(*) c FROM winners");
    const unifiedUndian = await count(
        "SELECT COUNT(*) c FROM program_winners WHERE mode = 'UNDIAN'"
    );
    check(
        "Semua winners undian terbawa",
        legacyWinners === unifiedUndian,
        `winners=${legacyWinners}, program_winners(UNDIAN)=${unifiedUndian}`
    );

    const mitraWinners = await count("SELECT COUNT(*) c FROM mitra_program_winners");
    const unifiedPerf = await count(
        "SELECT COUNT(*) c FROM program_winners WHERE mode = 'PERFORMANCE'"
    );
    check(
        "Semua pemenang performance terbawa",
        mitraWinners === unifiedPerf,
        `mitra_program_winners=${mitraWinners}, program_winners(PERFORMANCE)=${unifiedPerf}`
    );

    // --- Integrity ----------------------------------------------------------
    const orphanWinners = await count(`
        SELECT COUNT(*) c FROM program_winners pw
        LEFT JOIN programs p ON p.id = pw.program_id
        WHERE p.id IS NULL
    `);
    check("Tidak ada program_winners yatim", orphanWinners === 0, `yatim: ${orphanWinners}`);

    const badBranch = await count(`
        SELECT COUNT(*) c FROM program_winners
        WHERE (mode = 'UNDIAN' AND submission_id IS NULL)
           OR (mode = 'PERFORMANCE' AND outlet_id IS NULL)
    `);
    check(
        "Tiap pemenang mengisi cabang sesuai mode-nya",
        badBranch === 0,
        `baris salah cabang: ${badBranch}`
    );

    // Child tables still reference the preserved ids.
    for (const table of [
        "mitra_program_params",
        "mitra_program_participants",
        "mitra_program_scores",
        "mitra_program_leaderboard",
    ]) {
        const orphans = await count(`
            SELECT COUNT(*) c FROM ${table} t
            LEFT JOIN programs p ON p.id = t.program_id
            WHERE p.id IS NULL
        `);
        check(`${table} menunjuk program yang valid`, orphans === 0, `yatim: ${orphans}`);
    }

    // --- Slug collisions (informational) ------------------------------------
    const [renamed] = await conn.query(
        "SELECT slug FROM programs WHERE slug LIKE '%-undian-legacy' OR slug REGEXP '-undian-[0-9a-f]{8}$'"
    );
    if (renamed.length > 0) {
        console.log("\nSlug legacy yang di-rename karena bentrok dengan program Mitra:");
        for (const row of renamed) console.log(`  - ${row.slug}`);
        console.log("  (baris ini diarsipkan, datanya tidak dihapus - periksa bila perlu)\n");
    }

    await conn.end();

    let failed = 0;
    console.log("Hasil verifikasi migrasi program:\n");
    for (const r of results) {
        console.log(`  ${r.passed ? "OK  " : "GAGAL"}  ${r.label}\n         ${r.detail}`);
        if (!r.passed) failed++;
    }
    console.log("");

    if (failed > 0) {
        console.error(`${failed} pemeriksaan GAGAL. Jangan lanjutkan cutover kode.`);
        process.exit(1);
    }
    console.log("Semua pemeriksaan lulus.");
}

main().catch((error) => {
    // mysql2 leaves `message` empty on connection errors, so fall back to the code.
    const reason = error?.message || error?.code || String(error);
    console.error(`Verifikasi gagal dijalankan: ${reason}`);
    if (error?.code === "ECONNREFUSED") {
        console.error("Database tidak dapat dihubungi. Pastikan MySQL berjalan dan DATABASE_URL benar.");
    }
    process.exit(2);
});
