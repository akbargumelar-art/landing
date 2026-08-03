CREATE TABLE `indihome_products` (
	`id` varchar(80) NOT NULL,
	`name` varchar(255) NOT NULL,
	`speed_mbps` int NOT NULL,
	`monthly_price` decimal(12,2) NOT NULL,
	`description` text NOT NULL,
	`features` json NOT NULL,
	`locations` json NOT NULL,
	`is_featured` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `indihome_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `indihome_products_active_idx` ON `indihome_products` (`is_active`);--> statement-breakpoint
CREATE INDEX `indihome_products_sort_idx` ON `indihome_products` (`sort_order`);
--> statement-breakpoint
INSERT INTO `indihome_products` (`id`, `name`, `speed_mbps`, `monthly_price`, `description`, `features`, `locations`, `is_featured`, `is_active`, `sort_order`, `created_at`) VALUES
('internet-75', 'Internet Rumah 75', 75, 250000.00, 'Untuk browsing, belajar, dan hiburan keluarga sehari-hari.', JSON_ARRAY('Internet fiber', 'Cocok hingga 5 perangkat', 'Instalasi dikonfirmasi petugas'), JSON_ARRAY('Kota Cirebon', 'Kabupaten Cirebon', 'Kabupaten Kuningan'), false, true, 10, NOW()),
('internet-100', 'Internet Rumah 100', 100, 290000.00, 'Lebih leluasa untuk bekerja, streaming, dan belajar bersamaan.', JSON_ARRAY('Internet fiber', 'Cocok hingga 8 perangkat', 'Pilihan keluarga terpopuler'), JSON_ARRAY('Kota Cirebon', 'Kabupaten Cirebon', 'Kabupaten Kuningan'), true, true, 20, NOW()),
('internet-150', 'Internet Rumah 150', 150, 325000.00, 'Koneksi cepat untuk rumah aktif dengan banyak perangkat.', JSON_ARRAY('Internet fiber', 'Cocok hingga 12 perangkat', 'Streaming resolusi tinggi'), JSON_ARRAY('Kota Cirebon', 'Kabupaten Cirebon', 'Kabupaten Kuningan'), false, true, 30, NOW()),
('internet-200', 'Internet Rumah 200', 200, 490000.00, 'Performa maksimal untuk produktivitas dan hiburan tanpa jeda.', JSON_ARRAY('Internet fiber', 'Cocok hingga 15 perangkat', 'Prioritas untuk rumah beraktivitas tinggi'), JSON_ARRAY('Kota Cirebon', 'Kabupaten Cirebon'), false, true, 40, NOW());
