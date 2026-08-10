CREATE TABLE `mitra_visit_notifications` (
	`id` varchar(36) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`actor_phone` varchar(50),
	`photos_json` json,
	`location_changed` boolean NOT NULL DEFAULT false,
	`status` enum('PENDING','SENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
	`attempts` int NOT NULL DEFAULT 0,
	`last_error` varchar(500),
	`last_activity_at` datetime NOT NULL,
	`sent_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_visit_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_visit_notifications_session_id_unique` UNIQUE(`session_id`)
);
--> statement-breakpoint
ALTER TABLE `mitra_visit_notifications` ADD CONSTRAINT `mitra_visit_notifications_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mitra_visit_notif_status_idx` ON `mitra_visit_notifications` (`status`,`last_activity_at`);--> statement-breakpoint
CREATE INDEX `mitra_visit_notif_outlet_idx` ON `mitra_visit_notifications` (`outlet_id`);