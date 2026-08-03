CREATE TABLE `indihome_leads` (
	`id` varchar(36) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`phone_e164` varchar(50) NOT NULL,
	`email` varchar(255),
	`location` varchar(120) NOT NULL,
	`district` varchar(120) NOT NULL,
	`address` text NOT NULL,
	`package_id` varchar(80) NOT NULL,
	`package_name` varchar(255) NOT NULL,
	`status` enum('NEW','CONTACTED','SURVEY','SUBMITTED','CLOSED','CANCELLED') NOT NULL DEFAULT 'NEW',
	`consent` boolean NOT NULL,
	`source` varchar(80) NOT NULL DEFAULT 'landing_indihome',
	`ip` varchar(120),
	`user_agent` text,
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `indihome_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `indihome_leads_phone_idx` ON `indihome_leads` (`phone_e164`);--> statement-breakpoint
CREATE INDEX `indihome_leads_location_idx` ON `indihome_leads` (`location`);--> statement-breakpoint
CREATE INDEX `indihome_leads_status_idx` ON `indihome_leads` (`status`);--> statement-breakpoint
CREATE INDEX `indihome_leads_created_idx` ON `indihome_leads` (`created_at`);