-- ============================================================================
-- 1. redemption_logs.voucher_id menjadi nullable.
--
-- Cabang "stok voucher habis" di src/lib/auto-redeem.ts perlu mencatat kegagalan
-- justru ketika tidak ada voucher yang bisa dirujuk. Sebelumnya kolom ini NOT NULL
-- dan kode mengisinya dengan string 'NO-STOCK', yang melanggar foreign key ke
-- vouchers.id -- insert-nya melempar, tertangkap catch terluar, dan kegagalan stok
-- habis tidak pernah benar-benar tercatat. Terbukti di uji runtime 2026-08-06
-- (ER_NO_REFERENCED_ROW_2).
-- ============================================================================
ALTER TABLE `redemption_logs` MODIFY COLUMN `voucher_id` varchar(36);--> statement-breakpoint

-- ============================================================================
-- 2. Dua foreign key mitra_whitelist diberi nama yang muat di batas MySQL.
--
-- HATI-HATI: nama lama turunan Drizzle panjangnya 66 dan 69 karakter, melewati
-- batas 64 karakter identifier MySQL. Artinya constraint itu TIDAK PERNAH BISA
-- dibuat di database mana pun -- ALTER TABLE ... ADD CONSTRAINT selalu ditolak
-- ER_TOO_LONG_IDENT. Jadi di production constraint ini kemungkinan besar TIDAK ADA.
--
-- DROP FOREIGN KEY polos akan gagal (ER_CANT_DROP_FIELD_OR_KEY) untuk constraint
-- yang tidak ada, dan itu menggagalkan seluruh deploy. MySQL 8.0 tidak punya
-- DROP FOREIGN KEY IF EXISTS, jadi tiap langkah dijaga lewat information_schema dan
-- dijalankan sebagai prepared statement. Variabel sesi (@ada, @sql) bertahan antar
-- statement karena migrasi berjalan di satu koneksi. Seluruh blok aman diulang.
-- ============================================================================

-- 2a. Buang nama lama bila kebetulan ada.
SET @ada := (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = 'mitra_whitelist_numbers' AND constraint_name = 'mitra_whitelist_numbers_source_batch_id_mitra_import_batches_id_fk');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'ALTER TABLE `mitra_whitelist_numbers` DROP FOREIGN KEY `mitra_whitelist_numbers_source_batch_id_mitra_import_batches_id_fk`', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ada := (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = 'mitra_whitelist_usage_logs' AND constraint_name = 'mitra_whitelist_usage_logs_whitelist_id_mitra_whitelist_numbers_id_fk');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'ALTER TABLE `mitra_whitelist_usage_logs` DROP FOREIGN KEY `mitra_whitelist_usage_logs_whitelist_id_mitra_whitelist_numbers_id_fk`', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

-- 2b. Bersihkan referensi yatim lebih dulu, supaya ADD CONSTRAINT tidak ditolak karena
--     data lama menunjuk baris yang sudah tidak ada. Kedua FK memakai ON DELETE SET NULL,
--     jadi mengosongkannya konsisten dengan perilaku normalnya.
UPDATE `mitra_whitelist_numbers` w LEFT JOIN `mitra_import_batches` b ON b.`id` = w.`source_batch_id` SET w.`source_batch_id` = NULL WHERE w.`source_batch_id` IS NOT NULL AND b.`id` IS NULL;--> statement-breakpoint
UPDATE `mitra_whitelist_usage_logs` u LEFT JOIN `mitra_whitelist_numbers` w ON w.`id` = u.`whitelist_id` SET u.`whitelist_id` = NULL WHERE u.`whitelist_id` IS NOT NULL AND w.`id` IS NULL;--> statement-breakpoint

-- 2c. Pasang nama baru yang muat, hanya bila belum terpasang.
SET @ada := (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = 'mitra_whitelist_numbers' AND constraint_name = 'mitra_whitelist_source_batch_fk');--> statement-breakpoint
SET @sql := IF(@ada = 0, 'ALTER TABLE `mitra_whitelist_numbers` ADD CONSTRAINT `mitra_whitelist_source_batch_fk` FOREIGN KEY (`source_batch_id`) REFERENCES `mitra_import_batches`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ada := (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = 'mitra_whitelist_usage_logs' AND constraint_name = 'mitra_whitelist_usage_whitelist_fk');--> statement-breakpoint
SET @sql := IF(@ada = 0, 'ALTER TABLE `mitra_whitelist_usage_logs` ADD CONSTRAINT `mitra_whitelist_usage_whitelist_fk` FOREIGN KEY (`whitelist_id`) REFERENCES `mitra_whitelist_numbers`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;
