-- ============================================================================
-- Pemeriksaan HANYA-BACA kondisi database produksi.
-- Tidak mengubah apa pun. Jalankan di VPS:
--   mysql -u <user> -p <nama_database> < cek-produksi.sql
-- ============================================================================

SELECT '--- 1. Apakah tabel mitra_* ada? (migrasi 0000) ---' AS pemeriksaan;
SELECT COUNT(*) AS jumlah_tabel_mitra
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name LIKE 'mitra_%';
-- Harapan bila 0000 sudah diterapkan: 19. Bila 0: migrasi 0000 belum pernah jalan.

SELECT '--- 2. Apakah tabel RBAC ada? (migrasi 0003) ---' AS pemeriksaan;
SELECT COUNT(*) AS jumlah_tabel_admin
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('admin_user_profiles', 'admin_user_territories', 'admin_audit_logs');
-- Harapan bila 0003 sudah diterapkan: 3.

SELECT '--- 3. Migrasi apa saja yang tercatat sudah diterapkan? ---' AS pemeriksaan;
SELECT COUNT(*) AS jumlah_migrasi_tercatat
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name = '__drizzle_migrations';
-- Bila 0: drizzle belum pernah menjalankan migrasi di database ini sama sekali,
-- yang berarti skemanya dibangun lewat `drizzle-kit push`.

SELECT '--- 4. Tabel inti yang TIDAK dibuat migrasi mana pun ---' AS pemeriksaan;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('user', 'programs', 'products', 'orders', 'site_settings', 'form_submissions')
ORDER BY table_name;
-- Keenamnya harus ada; semuanya lahir dari `db:push`, bukan dari migrasi.
