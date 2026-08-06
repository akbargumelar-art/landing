-- Portal Mitra Outlet integration migration for an existing ABK Ciraya schema.
-- Requires the existing better-auth `user` table.
CREATE TABLE `mitra_audit_logs` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`action` varchar(80) NOT NULL,
	`entity` varchar(120) NOT NULL,
	`entity_id` varchar(36),
	`diff_json` json,
	`ip` varchar(120),
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_detail_sessions` (
	`id` varchar(36) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`phone_e164` varchar(50) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_detail_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_detail_sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `mitra_import_batches` (
	`id` varchar(36) NOT NULL,
	`type` varchar(50) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`row_count` int NOT NULL DEFAULT 0,
	`status` enum('PENDING','PROCESSING','COMPLETED','FAILED','ROLLED_BACK') NOT NULL DEFAULT 'PENDING',
	`error_log` json,
	`preview_json` json,
	`rollback_json` json,
	`created_by` varchar(36),
	`created_at` datetime NOT NULL,
	`rolled_back_at` datetime,
	CONSTRAINT `mitra_import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_metric_defs` (
	`id` varchar(36) NOT NULL,
	`key` varchar(120) NOT NULL,
	`label` varchar(255) NOT NULL,
	`unit` varchar(50),
	`aggregation` enum('SUM','AVG','LAST') NOT NULL DEFAULT 'SUM',
	`is_public` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_metric_defs_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_metric_defs_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `mitra_otp_requests` (
	`id` varchar(36) NOT NULL,
	`phone_e164` varchar(50) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`whitelist_id` varchar(36),
	`code_hash` varchar(255) NOT NULL,
	`code_salt` varchar(255) NOT NULL,
	`purpose` enum('OUTLET_DETAIL') NOT NULL DEFAULT 'OUTLET_DETAIL',
	`attempts` int NOT NULL DEFAULT 0,
	`expires_at` datetime NOT NULL,
	`verified_at` datetime,
	`ip` varchar(120),
	`user_agent` text,
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_otp_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_outlet_details` (
	`outlet_id` varchar(36) NOT NULL,
	`sellthru_digipos_json` json,
	`sellthru_nota_json` json,
	`recharge_digipos_json` json,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_outlet_details_outlet_id` PRIMARY KEY(`outlet_id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_outlet_metrics` (
	`id` varchar(36) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`metric_def_id` varchar(36) NOT NULL,
	`period_ym` varchar(7) NOT NULL,
	`value` decimal(18,2) NOT NULL DEFAULT '0.00',
	`source_batch_id` varchar(36),
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_outlet_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_outlet_metrics_unique_idx` UNIQUE(`outlet_id`,`metric_def_id`,`period_ym`)
);
--> statement-breakpoint
CREATE TABLE `mitra_outlets` (
	`id` varchar(36) NOT NULL,
	`outlet_code` varchar(100) NOT NULL,
	`public_token` varchar(80) NOT NULL,
	`rs_number` varchar(100) NOT NULL DEFAULT '',
	`name` varchar(255) NOT NULL,
	`owner_name` varchar(255) NOT NULL,
	`owner_phone` varchar(50) NOT NULL,
	`tap` varchar(255) NOT NULL DEFAULT '',
	`salesforce` varchar(255) NOT NULL DEFAULT '',
	`kabupaten` varchar(255) NOT NULL DEFAULT '',
	`kecamatan` varchar(255) NOT NULL DEFAULT '',
	`longitude` double,
	`latitude` double,
	`location_url` varchar(500),
	`territory_id` varchar(36),
	`category` varchar(50) NOT NULL DEFAULT 'FISIK',
	`pjp_day` varchar(50) NOT NULL DEFAULT 'Senin',
	`pjp_type` varchar(20) NOT NULL DEFAULT 'F1',
	`branding` varchar(100) NOT NULL DEFAULT '',
	`status` enum('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
	`photo_url` varchar(500),
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_outlets_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_outlets_outlet_code_unique` UNIQUE(`outlet_code`),
	CONSTRAINT `mitra_outlets_public_token_unique` UNIQUE(`public_token`)
);
--> statement-breakpoint
CREATE TABLE `mitra_program_leaderboard` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`total_points` decimal(18,2) NOT NULL DEFAULT '0.00',
	`rank` int NOT NULL,
	`prev_rank` int,
	`computed_at` datetime NOT NULL,
	CONSTRAINT `mitra_program_leaderboard_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_program_leaderboard_unique_idx` UNIQUE(`program_id`,`outlet_id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_program_params` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`key` varchar(120) NOT NULL,
	`label` varchar(255) NOT NULL,
	`unit` varchar(50),
	`weight` decimal(10,4) NOT NULL DEFAULT '1.0000',
	`aggregation` enum('SUM','AVG','LAST') NOT NULL DEFAULT 'SUM',
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `mitra_program_params_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_program_params_unique_idx` UNIQUE(`program_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `mitra_program_participants` (
	`program_id` varchar(36) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`joined_at` datetime NOT NULL,
	CONSTRAINT `mitra_program_participants_pk` PRIMARY KEY(`program_id`,`outlet_id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_program_scores` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`param_id` varchar(36) NOT NULL,
	`raw_value` decimal(18,2) NOT NULL DEFAULT '0.00',
	`points` decimal(18,2) NOT NULL DEFAULT '0.00',
	`period_ym` varchar(7) NOT NULL,
	`batch_id` varchar(36),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_program_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_program_scores_unique_idx` UNIQUE(`program_id`,`outlet_id`,`param_id`,`period_ym`)
);
--> statement-breakpoint
CREATE TABLE `mitra_program_winners` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`rank` int NOT NULL,
	`prize_label` varchar(255),
	`is_published` boolean NOT NULL DEFAULT false,
	CONSTRAINT `mitra_program_winners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_programs` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description_md` text,
	`mechanism_md` text,
	`period_start` datetime NOT NULL,
	`period_end` datetime NOT NULL,
	`status` enum('DRAFT','ACTIVE','ENDED','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
	`ranking_mode` enum('POINT','RANK') NOT NULL DEFAULT 'POINT',
	`tie_breaker` varchar(120),
	`is_public` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_programs_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_programs_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `mitra_territories` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('REGION','CLUSTER','AREA') NOT NULL,
	`parent_id` varchar(36),
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_territories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_user_profiles` (
	`user_id` varchar(36) NOT NULL,
	`phone` varchar(50),
	`role` enum('MANAGER','ADMIN','LEADER') NOT NULL DEFAULT 'MANAGER',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime,
	`failed_login_attempts` int NOT NULL DEFAULT 0,
	`last_failed_login_at` datetime,
	`locked_until` datetime,
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_user_profiles_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_user_territories` (
	`user_id` varchar(36) NOT NULL,
	`territory_id` varchar(36) NOT NULL,
	CONSTRAINT `mitra_user_territories_pk` PRIMARY KEY(`user_id`,`territory_id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_whitelist_numbers` (
	`id` varchar(36) NOT NULL,
	`phone_e164` varchar(50) NOT NULL,
	`name` varchar(255),
	`scope` enum('ALL','OUTLET','TERRITORY') NOT NULL DEFAULT 'ALL',
	`outlet_id` varchar(36),
	`territory_id` varchar(36),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(36),
	`source_batch_id` varchar(36),
	`expires_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_whitelist_numbers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_whitelist_usage_logs` (
	`id` varchar(36) NOT NULL,
	`whitelist_id` varchar(36),
	`phone_e164` varchar(50) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`action` enum('OTP_REQUESTED','OTP_VERIFIED','OTP_REJECTED') NOT NULL,
	`ip` varchar(120),
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_whitelist_usage_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mitra_audit_logs` ADD CONSTRAINT `mitra_audit_logs_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_detail_sessions` ADD CONSTRAINT `mitra_detail_sessions_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_import_batches` ADD CONSTRAINT `mitra_import_batches_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_otp_requests` ADD CONSTRAINT `mitra_otp_requests_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_otp_requests` ADD CONSTRAINT `mitra_otp_requests_whitelist_id_mitra_whitelist_numbers_id_fk` FOREIGN KEY (`whitelist_id`) REFERENCES `mitra_whitelist_numbers`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_outlet_details` ADD CONSTRAINT `mitra_outlet_details_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_outlet_metrics` ADD CONSTRAINT `mitra_outlet_metrics_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_outlet_metrics` ADD CONSTRAINT `mitra_outlet_metrics_metric_def_id_mitra_metric_defs_id_fk` FOREIGN KEY (`metric_def_id`) REFERENCES `mitra_metric_defs`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_outlets` ADD CONSTRAINT `mitra_outlets_territory_id_mitra_territories_id_fk` FOREIGN KEY (`territory_id`) REFERENCES `mitra_territories`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_leaderboard` ADD CONSTRAINT `mitra_program_leaderboard_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_leaderboard` ADD CONSTRAINT `mitra_program_leaderboard_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_params` ADD CONSTRAINT `mitra_program_params_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_participants` ADD CONSTRAINT `mitra_program_participants_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_participants` ADD CONSTRAINT `mitra_program_participants_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_scores` ADD CONSTRAINT `mitra_program_scores_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_scores` ADD CONSTRAINT `mitra_program_scores_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_scores` ADD CONSTRAINT `mitra_program_scores_param_id_mitra_program_params_id_fk` FOREIGN KEY (`param_id`) REFERENCES `mitra_program_params`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_scores` ADD CONSTRAINT `mitra_program_scores_batch_id_mitra_import_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `mitra_import_batches`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_winners` ADD CONSTRAINT `mitra_program_winners_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_program_winners` ADD CONSTRAINT `mitra_program_winners_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_user_profiles` ADD CONSTRAINT `mitra_user_profiles_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_user_territories` ADD CONSTRAINT `mitra_user_territories_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_user_territories` ADD CONSTRAINT `mitra_user_territories_territory_id_mitra_territories_id_fk` FOREIGN KEY (`territory_id`) REFERENCES `mitra_territories`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_whitelist_numbers` ADD CONSTRAINT `mitra_whitelist_numbers_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_whitelist_numbers` ADD CONSTRAINT `mitra_whitelist_numbers_territory_id_mitra_territories_id_fk` FOREIGN KEY (`territory_id`) REFERENCES `mitra_territories`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_whitelist_numbers` ADD CONSTRAINT `mitra_whitelist_numbers_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_whitelist_numbers` ADD CONSTRAINT `mitra_whitelist_numbers_source_batch_id_mitra_import_batches_id_fk` FOREIGN KEY (`source_batch_id`) REFERENCES `mitra_import_batches`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_whitelist_usage_logs` ADD CONSTRAINT `mitra_whitelist_usage_logs_whitelist_id_mitra_whitelist_numbers_id_fk` FOREIGN KEY (`whitelist_id`) REFERENCES `mitra_whitelist_numbers`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `mitra_whitelist_usage_logs` ADD CONSTRAINT `mitra_whitelist_usage_logs_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `mitra_audit_user_idx` ON `mitra_audit_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `mitra_audit_entity_idx` ON `mitra_audit_logs` (`entity`,`entity_id`);
--> statement-breakpoint
CREATE INDEX `mitra_audit_created_idx` ON `mitra_audit_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX `mitra_detail_sessions_outlet_idx` ON `mitra_detail_sessions` (`outlet_id`);
--> statement-breakpoint
CREATE INDEX `mitra_detail_sessions_expiry_idx` ON `mitra_detail_sessions` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `mitra_import_batches_type_idx` ON `mitra_import_batches` (`type`);
--> statement-breakpoint
CREATE INDEX `mitra_import_batches_status_idx` ON `mitra_import_batches` (`status`);
--> statement-breakpoint
CREATE INDEX `mitra_metric_defs_public_idx` ON `mitra_metric_defs` (`is_public`);
--> statement-breakpoint
CREATE INDEX `mitra_otp_phone_idx` ON `mitra_otp_requests` (`phone_e164`);
--> statement-breakpoint
CREATE INDEX `mitra_otp_outlet_idx` ON `mitra_otp_requests` (`outlet_id`);
--> statement-breakpoint
CREATE INDEX `mitra_otp_created_idx` ON `mitra_otp_requests` (`created_at`);
--> statement-breakpoint
CREATE INDEX `mitra_outlet_metrics_period_idx` ON `mitra_outlet_metrics` (`period_ym`);
--> statement-breakpoint
CREATE INDEX `mitra_outlet_metrics_batch_idx` ON `mitra_outlet_metrics` (`source_batch_id`);
--> statement-breakpoint
CREATE INDEX `mitra_outlets_public_token_idx` ON `mitra_outlets` (`public_token`);
--> statement-breakpoint
CREATE INDEX `mitra_outlets_name_idx` ON `mitra_outlets` (`name`);
--> statement-breakpoint
CREATE INDEX `mitra_outlets_owner_phone_idx` ON `mitra_outlets` (`owner_phone`);
--> statement-breakpoint
CREATE INDEX `mitra_outlets_territory_idx` ON `mitra_outlets` (`territory_id`);
--> statement-breakpoint
CREATE INDEX `mitra_outlets_status_idx` ON `mitra_outlets` (`status`);
--> statement-breakpoint
CREATE INDEX `mitra_program_leaderboard_rank_idx` ON `mitra_program_leaderboard` (`program_id`,`rank`);
--> statement-breakpoint
CREATE INDEX `mitra_program_params_program_idx` ON `mitra_program_params` (`program_id`);
--> statement-breakpoint
CREATE INDEX `mitra_program_participants_outlet_idx` ON `mitra_program_participants` (`outlet_id`);
--> statement-breakpoint
CREATE INDEX `mitra_program_scores_outlet_idx` ON `mitra_program_scores` (`outlet_id`);
--> statement-breakpoint
CREATE INDEX `mitra_program_scores_batch_idx` ON `mitra_program_scores` (`batch_id`);
--> statement-breakpoint
CREATE INDEX `mitra_program_winners_program_idx` ON `mitra_program_winners` (`program_id`);
--> statement-breakpoint
CREATE INDEX `mitra_program_winners_public_idx` ON `mitra_program_winners` (`is_published`);
--> statement-breakpoint
CREATE INDEX `mitra_programs_public_idx` ON `mitra_programs` (`is_public`);
--> statement-breakpoint
CREATE INDEX `mitra_programs_status_idx` ON `mitra_programs` (`status`);
--> statement-breakpoint
CREATE INDEX `mitra_territories_parent_idx` ON `mitra_territories` (`parent_id`);
--> statement-breakpoint
CREATE INDEX `mitra_territories_type_idx` ON `mitra_territories` (`type`);
--> statement-breakpoint
CREATE INDEX `mitra_user_profiles_role_idx` ON `mitra_user_profiles` (`role`);
--> statement-breakpoint
CREATE INDEX `mitra_user_territories_territory_idx` ON `mitra_user_territories` (`territory_id`);
--> statement-breakpoint
CREATE INDEX `mitra_whitelist_phone_idx` ON `mitra_whitelist_numbers` (`phone_e164`);
--> statement-breakpoint
CREATE INDEX `mitra_whitelist_scope_idx` ON `mitra_whitelist_numbers` (`scope`);
--> statement-breakpoint
CREATE INDEX `mitra_whitelist_outlet_idx` ON `mitra_whitelist_numbers` (`outlet_id`);
--> statement-breakpoint
CREATE INDEX `mitra_whitelist_territory_idx` ON `mitra_whitelist_numbers` (`territory_id`);
--> statement-breakpoint
CREATE INDEX `mitra_whitelist_usage_phone_idx` ON `mitra_whitelist_usage_logs` (`phone_e164`);
--> statement-breakpoint
CREATE INDEX `mitra_whitelist_usage_outlet_idx` ON `mitra_whitelist_usage_logs` (`outlet_id`);
