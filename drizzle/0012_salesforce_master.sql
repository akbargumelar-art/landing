-- ============================================================================
-- Nama dan foto salesforce dipindahkan dari kolom teks di mitra_outlets ke tabel
-- master mitra_salesforces, lalu ditautkan lewat mitra_outlets.salesforce_id.
--
-- URUTAN PENTING: kolom lama baru boleh dibuang setelah isinya selesai dipindahkan.
-- Versi hasil generate drizzle-kit langsung DROP COLUMN di akhir tanpa memindahkan
-- apa pun -- itu akan menghapus nama salesforce seluruh outlet.
--
-- Langkah yang menyentuh kolom lama dijaga lewat information_schema dan dijalankan
-- sebagai prepared statement, karena database yang dibangun dengan `drizzle-kit push`
-- belum tentu punya kolom salesforce_photo_url dari migrasi 0010. Variabel sesi
-- (@ada, @sql) bertahan antar statement karena migrasi berjalan di satu koneksi.
-- Seluruh blok aman diulang.
-- ============================================================================

CREATE TABLE `mitra_salesforces` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`photo_url` varchar(500),
	`phone` varchar(50),
	`tap` varchar(255) NOT NULL DEFAULT '',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_salesforces_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_salesforces_name_unique` UNIQUE(`name`)
);--> statement-breakpoint

CREATE INDEX `mitra_salesforces_active_idx` ON `mitra_salesforces` (`is_active`);--> statement-breakpoint

-- 1. Satu baris master untuk tiap nama salesforce yang pernah dipakai outlet.
SET @ada := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mitra_outlets' AND column_name = 'salesforce');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'INSERT INTO `mitra_salesforces` (`id`, `name`, `tap`, `is_active`, `created_at`) SELECT UUID(), s.nama, '''', 1, NOW() FROM (SELECT DISTINCT TRIM(`salesforce`) AS nama FROM `mitra_outlets` WHERE TRIM(`salesforce`) <> '''') AS s', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

-- 2. Foto yang sempat diisi per outlet (migrasi 0010) ikut pindah ke master.
--    MAX() dipakai karena satu salesforce bisa punya foto berbeda di beberapa outlet;
--    yang penting salah satunya terbawa, bukan hilang semua.
SET @ada := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mitra_outlets' AND column_name = 'salesforce_photo_url');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'UPDATE `mitra_salesforces` sf JOIN (SELECT TRIM(`salesforce`) AS nama, MAX(`salesforce_photo_url`) AS foto FROM `mitra_outlets` WHERE `salesforce_photo_url` IS NOT NULL AND TRIM(`salesforce`) <> '''' GROUP BY TRIM(`salesforce`)) x ON x.nama = sf.`name` SET sf.`photo_url` = x.foto', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

-- 3. Kolom penghubung, diisi dengan mencocokkan nama.
ALTER TABLE `mitra_outlets` ADD `salesforce_id` varchar(36);--> statement-breakpoint

SET @ada := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mitra_outlets' AND column_name = 'salesforce');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'UPDATE `mitra_outlets` o JOIN `mitra_salesforces` sf ON sf.`name` = TRIM(o.`salesforce`) SET o.`salesforce_id` = sf.`id`', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

ALTER TABLE `mitra_outlets` ADD CONSTRAINT `mitra_outlets_salesforce_id_mitra_salesforces_id_fk` FOREIGN KEY (`salesforce_id`) REFERENCES `mitra_salesforces`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mitra_outlets_salesforce_idx` ON `mitra_outlets` (`salesforce_id`);--> statement-breakpoint

-- 4. Baru sekarang kolom lama dibuang, dan hanya bila memang ada.
SET @ada := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mitra_outlets' AND column_name = 'salesforce');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'ALTER TABLE `mitra_outlets` DROP COLUMN `salesforce`', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ada := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mitra_outlets' AND column_name = 'salesforce_photo_url');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'ALTER TABLE `mitra_outlets` DROP COLUMN `salesforce_photo_url`', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;
