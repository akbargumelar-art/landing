-- ============================================================================
-- Scope whitelist OTP: TERRITORY diganti TAP, plus kolom keterangan.
--
-- URUTAN PENTING: baris ber-scope 'TERRITORY' harus dipindahkan SELAGI enum lama
-- masih berlaku. Kalau MODIFY COLUMN dijalankan lebih dulu, MySQL strict mode
-- menolak seluruh perintah karena ada baris bernilai di luar daftar enum baru.
--
-- Baris TERRITORY yang dipindahkan juga DINONAKTIFKAN. Nama territory (mis. "Area
-- Kesambi") bukan nama TAP, jadi mencocokkannya otomatis akan salah: membiarkannya
-- aktif berarti nomor itu diam-diam kehilangan atau justru mendapat akses yang
-- tidak diniatkan. Admin tinggal memilih TAP yang benar lalu mengaktifkannya lagi.
--
-- Langkah yang menyentuh kolom lama dijaga information_schema, mengikuti pola
-- migrasi 0009, supaya aman untuk database yang dibangun `drizzle-kit push`.
-- ============================================================================

ALTER TABLE `mitra_whitelist_numbers` ADD `keterangan` varchar(255);--> statement-breakpoint
ALTER TABLE `mitra_whitelist_numbers` ADD `tap` varchar(255);--> statement-breakpoint

-- 1. Pindahkan baris TERRITORY: nama territory disalin sebagai ancar-ancar TAP,
--    lalu barisnya dinonaktifkan supaya tidak berlaku sebelum diperiksa admin.
SET @ada := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mitra_whitelist_numbers' AND column_name = 'territory_id');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'UPDATE `mitra_whitelist_numbers` w LEFT JOIN `mitra_territories` t ON t.`id` = w.`territory_id` SET w.`tap` = t.`name`, w.`is_active` = 0, w.`keterangan` = CONCAT(COALESCE(w.`keterangan`, ''''), ''[perlu cek: dipindahkan dari scope wilayah]'') WHERE w.`scope` = ''TERRITORY''', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

-- 2. Sisa nilai TERRITORY (yang territory_id-nya sudah kosong) ikut dipindahkan,
--    kalau tidak MODIFY COLUMN di langkah 3 akan ditolak.
UPDATE `mitra_whitelist_numbers` SET `scope` = 'OUTLET', `is_active` = 0 WHERE `scope` = 'TERRITORY' AND `outlet_id` IS NOT NULL;--> statement-breakpoint
UPDATE `mitra_whitelist_numbers` SET `scope` = 'ALL', `is_active` = 0 WHERE `scope` = 'TERRITORY';--> statement-breakpoint

-- 3. Daftar enum baru.
ALTER TABLE `mitra_whitelist_numbers` MODIFY COLUMN `scope` enum('ALL','OUTLET','TAP') NOT NULL DEFAULT 'ALL';--> statement-breakpoint

-- 4. Baris hasil langkah 1 diarahkan ke scope TAP setelah enum-nya ada.
UPDATE `mitra_whitelist_numbers` SET `scope` = 'TAP' WHERE `tap` IS NOT NULL AND `tap` <> '' AND `is_active` = 0;--> statement-breakpoint

CREATE INDEX `mitra_whitelist_tap_idx` ON `mitra_whitelist_numbers` (`tap`);--> statement-breakpoint

-- 5. Kolom territory_id dibuang beserta index dan foreign key-nya, hanya bila ada.
SET @ada := (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = 'mitra_whitelist_numbers' AND constraint_name = 'mitra_whitelist_numbers_territory_id_mitra_territories_id_fk');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'ALTER TABLE `mitra_whitelist_numbers` DROP FOREIGN KEY `mitra_whitelist_numbers_territory_id_mitra_territories_id_fk`', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ada := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'mitra_whitelist_numbers' AND index_name = 'mitra_whitelist_territory_idx');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'DROP INDEX `mitra_whitelist_territory_idx` ON `mitra_whitelist_numbers`', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

SET @ada := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mitra_whitelist_numbers' AND column_name = 'territory_id');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'ALTER TABLE `mitra_whitelist_numbers` DROP COLUMN `territory_id`', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;
