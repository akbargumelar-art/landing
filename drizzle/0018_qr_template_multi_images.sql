-- ============================================================================
-- Logo tunggal pada template kartu QR menjadi daftar gambar bebas.
--
-- URUTAN PENTING: isi kolom logo dipindahkan ke images_json SEBELUM kolomnya dibuang.
-- Versi hasil generate drizzle-kit langsung DROP COLUMN, yang akan menghapus logo pada
-- template yang sudah dibuat admin sejak rilis sebelumnya.
--
-- Langkah pemindahan dijaga information_schema karena tabel ini baru lahir di migrasi
-- 0016: pada database yang dibangun `drizzle-kit push`, kolom logo bisa saja memang
-- belum pernah ada.
-- ============================================================================

ALTER TABLE `mitra_qr_templates` ADD `images_json` json;--> statement-breakpoint

-- Logo lama menjadi satu entri pertama pada daftar gambar, koordinat dan lebarnya utuh.
SET @ada := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mitra_qr_templates' AND column_name = 'logo_url');--> statement-breakpoint
SET @sql := IF(@ada > 0, 'UPDATE `mitra_qr_templates` SET `images_json` = JSON_ARRAY(JSON_OBJECT(''id'', ''logo-lama'', ''url'', `logo_url`, ''x'', `logo_x`, ''y'', `logo_y`, ''width'', `logo_width`)) WHERE `logo_url` IS NOT NULL AND `logo_url` <> ''''', 'DO 0');--> statement-breakpoint
PREPARE stmt FROM @sql;--> statement-breakpoint
EXECUTE stmt;--> statement-breakpoint
DEALLOCATE PREPARE stmt;--> statement-breakpoint

ALTER TABLE `mitra_qr_templates` DROP COLUMN `logo_url`;--> statement-breakpoint
ALTER TABLE `mitra_qr_templates` DROP COLUMN `logo_x`;--> statement-breakpoint
ALTER TABLE `mitra_qr_templates` DROP COLUMN `logo_y`;--> statement-breakpoint
ALTER TABLE `mitra_qr_templates` DROP COLUMN `logo_width`;
