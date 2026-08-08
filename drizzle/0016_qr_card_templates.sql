CREATE TABLE `mitra_qr_templates` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`background_color` varchar(20) NOT NULL DEFAULT '#ffffff',
	`background_image_url` varchar(500),
	`logo_url` varchar(500),
	`logo_x` decimal(6,2) NOT NULL DEFAULT '4.00',
	`logo_y` decimal(6,2) NOT NULL DEFAULT '4.00',
	`logo_width` decimal(6,2) NOT NULL DEFAULT '18.00',
	`qr_x` decimal(6,2) NOT NULL DEFAULT '5.00',
	`qr_y` decimal(6,2) NOT NULL DEFAULT '14.00',
	`qr_size` decimal(6,2) NOT NULL DEFAULT '34.00',
	`elements_json` json,
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_qr_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `mitra_qr_templates_default_idx` ON `mitra_qr_templates` (`is_default`);