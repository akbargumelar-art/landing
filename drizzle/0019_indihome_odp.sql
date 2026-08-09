CREATE TABLE `indihome_odp` (
	`id` varchar(36) NOT NULL,
	`code` varchar(120),
	`kabupaten` varchar(255) NOT NULL,
	`kecamatan` varchar(255) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`port_total` int NOT NULL DEFAULT 0,
	`port_used` int NOT NULL DEFAULT 0,
	`port_available` int NOT NULL DEFAULT 0,
	`category` enum('GREEN','YELLOW','ORANGE','BLACK'),
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `indihome_odp_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `indihome_odp_kabupaten_idx` ON `indihome_odp` (`kabupaten`);--> statement-breakpoint
CREATE INDEX `indihome_odp_kecamatan_idx` ON `indihome_odp` (`kecamatan`);--> statement-breakpoint
CREATE INDEX `indihome_odp_category_idx` ON `indihome_odp` (`category`);