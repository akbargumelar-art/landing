CREATE TABLE `mitra_outlet_edit_logs` (
	`id` varchar(36) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`actor_type` enum('MITRA','ADMIN') NOT NULL,
	`actor_phone` varchar(50),
	`actor_user_id` varchar(36),
	`action` enum('PHOTO','LOCATION') NOT NULL,
	`before_json` json,
	`after_json` json,
	`ip` varchar(120),
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_outlet_edit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mitra_outlet_edit_logs` ADD CONSTRAINT `mitra_outlet_edit_logs_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mitra_outlet_edit_logs_outlet_idx` ON `mitra_outlet_edit_logs` (`outlet_id`);--> statement-breakpoint
CREATE INDEX `mitra_outlet_edit_logs_created_idx` ON `mitra_outlet_edit_logs` (`created_at`);