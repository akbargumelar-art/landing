-- ============================================================================
-- Pemeriksaan HANYA-BACA kondisi database. Tidak mengubah apa pun.
--   mysql -u <user> -p <nama_database> < scripts/cek-produksi.sql
--
-- Latar: skema produksi dibangun lewat `drizzle-kit push`, bukan `db:migrate`
-- (terbukti dari tidak adanya __drizzle_migrations). Akibatnya SELURUH TABEL ada,
-- tetapi TIDAK SATU PUN backfill data di dalam migrasi pernah dijalankan --
-- `push` hanya menyamakan BENTUK skema, ia tidak pernah mengeksekusi INSERT/UPDATE
-- yang ditulis di berkas migrasi. Skrip ini memastikan backfill mana yang belum jalan.
-- ============================================================================

SELECT '=== A. Bentuk skema ===' AS bagian;

SELECT 'tabel mitra_* (0000)' AS item, COUNT(*) AS nilai, '19' AS harapan
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name LIKE 'mitra\_%'
UNION ALL
SELECT 'tabel RBAC (0003)', COUNT(*), '3'
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('admin_user_profiles','admin_user_territories','admin_audit_logs')
UNION ALL
SELECT 'riwayat __drizzle_migrations', COUNT(*), '1 bila pernah db:migrate'
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name = '__drizzle_migrations'
UNION ALL
SELECT 'kolom programs.mode (0004)', COUNT(*), '1'
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'programs' AND column_name = 'mode'
UNION ALL
SELECT 'kolom programs.wa_template (0008)', COUNT(*), '1'
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'programs' AND column_name = 'wa_template'
UNION ALL
SELECT 'index form_submissions (0006)', COUNT(DISTINCT index_name), '3'
FROM information_schema.statistics
WHERE table_schema = DATABASE() AND table_name = 'form_submissions'
  AND index_name IN ('form_submissions_form_idx','form_submissions_status_idx','form_submissions_submitted_idx')
UNION ALL
SELECT 'redemption_logs.voucher_id nullable (0009)', SUM(is_nullable = 'YES'), '1 setelah 0009'
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'redemption_logs' AND column_name = 'voucher_id';

SELECT '=== B. Backfill RBAC (PALING PENTING) ===' AS bagian;
-- Bila ada user tanpa baris profil, mereka DITOLAK masuk panel admin -- kecuali akun
-- bootstrap (ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAIL, default admin@abkciraya.com).
SELECT 'user terdaftar' AS item, COUNT(*) AS jumlah FROM user
UNION ALL
SELECT 'punya admin_user_profiles', COUNT(*) FROM admin_user_profiles
UNION ALL
SELECT 'user TANPA profil (akan terkunci)',
       (SELECT COUNT(*) FROM user u
        LEFT JOIN admin_user_profiles p ON p.user_id = u.id
        WHERE p.user_id IS NULL);

SELECT '=== C. Seed IndiHome (0002 dan 0005) ===' AS bagian;
-- Bila indihome_products 0, halaman /indihome memakai katalog fallback statis, dan
-- paket fallback itu TIDAK BISA DIPESAN (lihat docs/uji-lanjutan-2026-08-06.md).
SELECT 'indihome_products' AS item, COUNT(*) AS jumlah FROM indihome_products
UNION ALL
SELECT 'indihome_locations', COUNT(*) FROM indihome_locations
UNION ALL
SELECT 'indihome_banners', COUNT(*) FROM indihome_banners;

SELECT '=== D. Backfill program terpadu (0004) ===' AS bagian;
-- Selama Fase 3b belum dikerjakan, tabel terpadu memang menganggur, jadi kosong di
-- sini TIDAK merusak apa pun. Dicatat hanya supaya keadaannya diketahui.
SELECT 'programs mode=UNDIAN' AS item, COUNT(*) AS jumlah FROM programs WHERE mode = 'UNDIAN'
UNION ALL
SELECT 'programs mode=PERFORMANCE', COUNT(*) FROM programs WHERE mode = 'PERFORMANCE'
UNION ALL
SELECT 'mitra_programs', COUNT(*) FROM mitra_programs
UNION ALL
SELECT 'program_winners (terpadu)', COUNT(*) FROM program_winners
UNION ALL
SELECT 'winners (lama)', COUNT(*) FROM winners;

SELECT '=== E. Nama foreign key whitelist ===' AS bagian;
SELECT table_name, constraint_name
FROM information_schema.table_constraints
WHERE constraint_schema = DATABASE() AND constraint_type = 'FOREIGN KEY'
  AND table_name IN ('mitra_whitelist_numbers','mitra_whitelist_usage_logs')
ORDER BY table_name, constraint_name;
