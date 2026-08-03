-- ============================================================================
-- Master outlet: batasi category / pjp_day / pjp_type / branding ke pilihan tetap.
--
-- URUTAN PENTING: data dinormalisasi SELAGI kolom masih varchar. Kalau ALTER
-- dijalankan lebih dulu, MySQL strict mode akan menolak baris yang nilainya di luar
-- daftar enum (dan pada mode longgar diam-diam mengubahnya jadi ''). Kasus paling nyata:
-- `branding` selama ini berdefault string kosong, dan '' bukan anggota enum.
--
-- Nilai tak dikenal dipetakan ke default, bukan dibuang, agar tidak ada baris yang hilang.
-- ============================================================================

-- 1. branding: '' -> 'Non Branding'; nama provider disamakan kapitalisasinya;
--    sisanya (mis. merek lain yang pernah diketik bebas) -> 'Lainnya'.
UPDATE `mitra_outlets` SET `branding` = 'Non Branding'
WHERE `branding` IS NULL OR TRIM(`branding`) = '' OR LOWER(TRIM(`branding`)) = 'non branding';--> statement-breakpoint
UPDATE `mitra_outlets` SET `branding` = 'Telkomsel' WHERE LOWER(TRIM(`branding`)) = 'telkomsel';--> statement-breakpoint
UPDATE `mitra_outlets` SET `branding` = 'byU' WHERE LOWER(TRIM(`branding`)) = 'byu';--> statement-breakpoint
UPDATE `mitra_outlets` SET `branding` = 'XL' WHERE LOWER(TRIM(`branding`)) = 'xl';--> statement-breakpoint
UPDATE `mitra_outlets` SET `branding` = 'Axis' WHERE LOWER(TRIM(`branding`)) = 'axis';--> statement-breakpoint
UPDATE `mitra_outlets` SET `branding` = 'Smartfren' WHERE LOWER(TRIM(`branding`)) = 'smartfren';--> statement-breakpoint
UPDATE `mitra_outlets` SET `branding` = 'Indosat' WHERE LOWER(TRIM(`branding`)) = 'indosat';--> statement-breakpoint
UPDATE `mitra_outlets` SET `branding` = 'Tri' WHERE LOWER(TRIM(`branding`)) IN ('tri', '3');--> statement-breakpoint
UPDATE `mitra_outlets` SET `branding` = 'BRILINK' WHERE LOWER(TRIM(`branding`)) IN ('brilink', 'bri link');--> statement-breakpoint
UPDATE `mitra_outlets` SET `branding` = 'Lainnya'
WHERE `branding` NOT IN ('Non Branding','Telkomsel','byU','XL','Axis','Smartfren','Indosat','Tri','BRILINK','Lainnya');--> statement-breakpoint

-- 2. category: hanya FISIK / Non FISIK.
UPDATE `mitra_outlets` SET `category` = 'Non FISIK'
WHERE REPLACE(LOWER(TRIM(`category`)), '-', ' ') IN ('non fisik', 'nonfisik');--> statement-breakpoint
UPDATE `mitra_outlets` SET `category` = 'FISIK' WHERE `category` <> 'Non FISIK';--> statement-breakpoint

-- 3. pjp_day: samakan kapitalisasi; nilai tak dikenal -> Senin.
UPDATE `mitra_outlets` SET `pjp_day` = CONCAT(UPPER(LEFT(TRIM(`pjp_day`), 1)), LOWER(SUBSTRING(TRIM(`pjp_day`), 2)));--> statement-breakpoint
UPDATE `mitra_outlets` SET `pjp_day` = 'Senin'
WHERE `pjp_day` NOT IN ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu');--> statement-breakpoint

-- 4. pjp_type: F1..F8; nilai tak dikenal -> F1.
UPDATE `mitra_outlets` SET `pjp_type` = UPPER(TRIM(`pjp_type`));--> statement-breakpoint
UPDATE `mitra_outlets` SET `pjp_type` = 'F1'
WHERE `pjp_type` NOT IN ('F1','F2','F3','F4','F5','F6','F7','F8');--> statement-breakpoint

-- 5. Baru ubah tipe kolomnya.
ALTER TABLE `mitra_outlets` MODIFY COLUMN `category` enum('FISIK','Non FISIK') NOT NULL DEFAULT 'FISIK';--> statement-breakpoint
ALTER TABLE `mitra_outlets` MODIFY COLUMN `pjp_day` enum('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu') NOT NULL DEFAULT 'Senin';--> statement-breakpoint
ALTER TABLE `mitra_outlets` MODIFY COLUMN `pjp_type` enum('F1','F2','F3','F4','F5','F6','F7','F8') NOT NULL DEFAULT 'F1';--> statement-breakpoint
ALTER TABLE `mitra_outlets` MODIFY COLUMN `branding` enum('Non Branding','Telkomsel','byU','XL','Axis','Smartfren','Indosat','Tri','BRILINK','Lainnya') NOT NULL DEFAULT 'Non Branding';--> statement-breakpoint

-- 6. Isi location_url dari koordinat yang sudah ada, supaya tautan lokasi seragam
--    dengan yang dihasilkan aplikasi (buildOutletMapsUrl).
UPDATE `mitra_outlets`
SET `location_url` = CONCAT('https://www.google.com/maps/search/?api=1&query=', `latitude`, ',', `longitude`)
WHERE `latitude` IS NOT NULL AND `longitude` IS NOT NULL
  AND `latitude` BETWEEN -90 AND 90 AND `longitude` BETWEEN -180 AND 180;
