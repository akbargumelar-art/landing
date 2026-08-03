CREATE TABLE `indihome_banners` (
	`id` varchar(36) NOT NULL,
	`image_url` varchar(500) NOT NULL DEFAULT '',
	`headline` varchar(255) NOT NULL DEFAULT '',
	`subheadline` varchar(500) NOT NULL DEFAULT '',
	`cta_text` varchar(255) NOT NULL DEFAULT '',
	`cta_link` varchar(500) NOT NULL DEFAULT '',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `indihome_banners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `indihome_locations` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	CONSTRAINT `indihome_locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `indihome_locations_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `indihome_banners_active_idx` ON `indihome_banners` (`is_active`);--> statement-breakpoint
CREATE INDEX `indihome_banners_sort_idx` ON `indihome_banners` (`sort_order`);--> statement-breakpoint
CREATE INDEX `indihome_locations_active_idx` ON `indihome_locations` (`is_active`);--> statement-breakpoint
CREATE INDEX `indihome_locations_sort_idx` ON `indihome_locations` (`sort_order`);--> statement-breakpoint
-- Seed from the values that used to be hardcoded, so the public page keeps working the
-- moment this migration lands (prd-total-revamp.md risk: "Data lokasi/banner IndiHome
-- kosong pasca migrasi"). Re-runnable.
INSERT INTO `indihome_locations` (`id`, `name`, `is_active`, `sort_order`, `created_at`)
SELECT * FROM (
    SELECT UUID() AS id, 'Kota Cirebon' AS name, true AS is_active, 0 AS sort_order, NOW() AS created_at
    UNION ALL SELECT UUID(), 'Kabupaten Cirebon', true, 1, NOW()
    UNION ALL SELECT UUID(), 'Kabupaten Kuningan', true, 2, NOW()
) AS seed
WHERE NOT EXISTS (
    SELECT 1 FROM `indihome_locations` existing WHERE existing.`name` = seed.`name`
);--> statement-breakpoint
-- Seed the current static hero as the first banner row.
INSERT INTO `indihome_banners`
    (`id`, `image_url`, `headline`, `subheadline`, `cta_text`, `cta_link`, `is_active`, `sort_order`, `created_at`)
SELECT UUID(), '/indihome/hero-family.png',
       'Internet rumah untuk semua aktivitas keluarga',
       'Temukan pilihan kecepatan berdasarkan lokasi Anda, lalu ajukan pemasangan dalam beberapa langkah.',
       'Lihat paket tersedia', '#paket', true, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM `indihome_banners`);