ALTER TABLE `mitra_detail_sessions` MODIFY COLUMN `outlet_id` varchar(36);--> statement-breakpoint
ALTER TABLE `mitra_otp_requests` MODIFY COLUMN `outlet_id` varchar(36);--> statement-breakpoint
ALTER TABLE `mitra_otp_requests` MODIFY COLUMN `purpose` enum('OUTLET_DETAIL','PROGRAM_DETAIL') NOT NULL DEFAULT 'OUTLET_DETAIL';--> statement-breakpoint
ALTER TABLE `mitra_whitelist_usage_logs` MODIFY COLUMN `outlet_id` varchar(36);--> statement-breakpoint
ALTER TABLE `mitra_detail_sessions` ADD `program_id` varchar(36);--> statement-breakpoint
ALTER TABLE `mitra_otp_requests` ADD `program_id` varchar(36);--> statement-breakpoint
ALTER TABLE `mitra_whitelist_usage_logs` ADD `program_id` varchar(36);--> statement-breakpoint
ALTER TABLE `mitra_detail_sessions` ADD CONSTRAINT `mitra_detail_sessions_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_otp_requests` ADD CONSTRAINT `mitra_otp_requests_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_whitelist_usage_logs` ADD CONSTRAINT `mitra_whitelist_usage_logs_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mitra_detail_sessions_program_idx` ON `mitra_detail_sessions` (`program_id`);