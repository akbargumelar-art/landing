-- ============================================================================
-- Kolom `code` pada indihome_odp menjadi `name` yang unik.
--
-- Versi hasil generate drizzle-kit menambah kolom baru lalu DROP COLUMN `code`,
-- yang membuang isinya. Di sini kolomnya DIGANTI NAMA sehingga nilai yang sudah
-- terunggah tetap ada.
--
-- Unique index dipasang setelah nilai ganda dikosongkan. Tanpa itu, satu nama
-- berulang cukup untuk menggagalkan seluruh migrasi -- dan karena migrasi berjalan
-- otomatis saat kontainer start, kegagalannya berarti aplikasi tidak naik.
-- NULL dibiarkan banyak: MySQL tidak menganggapnya bentrok pada unique index.
-- ============================================================================

SET @ada := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'indihome_odp' AND column_name = 'code');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'ALTER TABLE `indihome_odp` CHANGE `code` `name` varchar(160)', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

-- Kolom dibuat bila database dibangun `drizzle-kit push` dan tidak pernah punya `code`.
SET @ada := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'indihome_odp' AND column_name = 'name');--> statement-breakpoint
SET @sql := IF(@ada = 0, 'ALTER TABLE `indihome_odp` ADD `name` varchar(160)', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

-- Nama ganda dikosongkan; yang tersimpan lebih dulu (id terkecil) dipertahankan.
UPDATE `indihome_odp` t
JOIN (
    SELECT `name` AS nama, MIN(`id`) AS id_awal
    FROM `indihome_odp`
    WHERE `name` IS NOT NULL AND `name` <> ''
    GROUP BY `name`
    HAVING COUNT(*) > 1
) d ON d.nama = t.`name` AND t.`id` <> d.id_awal
SET t.`name` = NULL;--> statement-breakpoint

UPDATE `indihome_odp` SET `name` = NULL WHERE `name` = '';--> statement-breakpoint

SET @ada := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'indihome_odp' AND index_name = 'indihome_odp_name_unique');--> statement-breakpoint
SET @sql := IF(@ada = 0, 'ALTER TABLE `indihome_odp` ADD CONSTRAINT `indihome_odp_name_unique` UNIQUE(`name`)', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;
