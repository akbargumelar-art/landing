CREATE TABLE `mitra_kabupatens` (
	`id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_kabupatens_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_kabupatens_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `mitra_kecamatans` (
	`id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_kecamatans_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_kecamatans_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `mitra_program_leaderboard` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`participant_key` varchar(60) NOT NULL,
	`outlet_id` varchar(36),
	`salesforce_id` varchar(36),
	`total_points` decimal(18,2) NOT NULL DEFAULT '0.00',
	`rank` int NOT NULL,
	`prev_rank` int,
	`computed_at` datetime NOT NULL,
	CONSTRAINT `mitra_program_leaderboard_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_program_leaderboard_unique_idx` UNIQUE(`program_id`,`participant_key`)
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
	`participant_key` varchar(60) NOT NULL,
	`outlet_id` varchar(36),
	`salesforce_id` varchar(36),
	`joined_at` datetime NOT NULL,
	CONSTRAINT `mitra_program_participants_pk` PRIMARY KEY(`program_id`,`participant_key`)
);
--> statement-breakpoint
CREATE TABLE `mitra_program_reward_rules` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`rank_from` int,
	`rank_to` int,
	`param_key` varchar(120),
	`comparator` enum('>=','>','<=','<','='),
	`threshold_value` decimal(18,2),
	`reward_label` varchar(255) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `mitra_program_reward_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mitra_program_scores` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`participant_key` varchar(60) NOT NULL,
	`outlet_id` varchar(36),
	`salesforce_id` varchar(36),
	`param_id` varchar(36) NOT NULL,
	`raw_value` decimal(18,2) NOT NULL DEFAULT '0.00',
	`points` decimal(18,2) NOT NULL DEFAULT '0.00',
	`achievement_date` date NOT NULL,
	`batch_id` varchar(36),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_program_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_program_scores_unique_idx` UNIQUE(`program_id`,`participant_key`,`param_id`,`achievement_date`)
);
--> statement-breakpoint
CREATE TABLE `mitra_program_winners` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`participant_key` varchar(60) NOT NULL,
	`outlet_id` varchar(36),
	`salesforce_id` varchar(36),
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
	`target_type` enum('OUTLET','SALESFORCE') NOT NULL DEFAULT 'OUTLET',
	`mechanism_type` enum('RACING','REWARD') NOT NULL DEFAULT 'RACING',
	`description_md` text,
	`mechanism_md` text,
	`period_start` datetime NOT NULL,
	`period_end` datetime NOT NULL,
	`status` enum('DRAFT','ACTIVE','ENDED','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
	`is_public` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_programs_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_programs_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `mitra_taps` (
	`id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `mitra_taps_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_taps_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `mitra_program_leaderboard` ADD CONSTRAINT `mitra_program_leaderboard_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_leaderboard` ADD CONSTRAINT `mitra_program_leaderboard_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_leaderboard` ADD CONSTRAINT `mitra_program_leaderboard_salesforce_id_mitra_salesforces_id_fk` FOREIGN KEY (`salesforce_id`) REFERENCES `mitra_salesforces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_params` ADD CONSTRAINT `mitra_program_params_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_participants` ADD CONSTRAINT `mitra_program_participants_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_participants` ADD CONSTRAINT `mitra_program_participants_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_participants` ADD CONSTRAINT `mitra_program_participants_salesforce_id_mitra_salesforces_id_fk` FOREIGN KEY (`salesforce_id`) REFERENCES `mitra_salesforces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_reward_rules` ADD CONSTRAINT `mitra_program_reward_rules_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_scores` ADD CONSTRAINT `mitra_program_scores_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_scores` ADD CONSTRAINT `mitra_program_scores_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_scores` ADD CONSTRAINT `mitra_program_scores_salesforce_id_mitra_salesforces_id_fk` FOREIGN KEY (`salesforce_id`) REFERENCES `mitra_salesforces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_scores` ADD CONSTRAINT `mitra_program_scores_param_id_mitra_program_params_id_fk` FOREIGN KEY (`param_id`) REFERENCES `mitra_program_params`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_scores` ADD CONSTRAINT `mitra_program_scores_batch_id_mitra_import_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `mitra_import_batches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_winners` ADD CONSTRAINT `mitra_program_winners_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_winners` ADD CONSTRAINT `mitra_program_winners_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_program_winners` ADD CONSTRAINT `mitra_program_winners_salesforce_id_mitra_salesforces_id_fk` FOREIGN KEY (`salesforce_id`) REFERENCES `mitra_salesforces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mitra_program_leaderboard_rank_idx` ON `mitra_program_leaderboard` (`program_id`,`rank`);--> statement-breakpoint
CREATE INDEX `mitra_program_params_program_idx` ON `mitra_program_params` (`program_id`);--> statement-breakpoint
CREATE INDEX `mitra_program_participants_outlet_idx` ON `mitra_program_participants` (`outlet_id`);--> statement-breakpoint
CREATE INDEX `mitra_program_participants_sf_idx` ON `mitra_program_participants` (`salesforce_id`);--> statement-breakpoint
CREATE INDEX `mitra_program_reward_rules_program_idx` ON `mitra_program_reward_rules` (`program_id`);--> statement-breakpoint
CREATE INDEX `mitra_program_scores_outlet_idx` ON `mitra_program_scores` (`outlet_id`);--> statement-breakpoint
CREATE INDEX `mitra_program_scores_sf_idx` ON `mitra_program_scores` (`salesforce_id`);--> statement-breakpoint
CREATE INDEX `mitra_program_scores_batch_idx` ON `mitra_program_scores` (`batch_id`);--> statement-breakpoint
CREATE INDEX `mitra_program_winners_program_idx` ON `mitra_program_winners` (`program_id`);--> statement-breakpoint
CREATE INDEX `mitra_program_winners_public_idx` ON `mitra_program_winners` (`is_published`);--> statement-breakpoint
CREATE INDEX `mitra_programs_public_idx` ON `mitra_programs` (`is_public`);--> statement-breakpoint
CREATE INDEX `mitra_programs_status_idx` ON `mitra_programs` (`status`);--> statement-breakpoint
CREATE INDEX `mitra_programs_target_idx` ON `mitra_programs` (`target_type`,`mechanism_type`);--> statement-breakpoint
-- Daftar master diisi dari nilai yang SUDAH dipakai outlet dan salesforce, supaya
-- dropdown tidak berangkat kosong dan data lama tetap punya pilihan yang cocok.
INSERT INTO `mitra_taps` (`id`, `name`, `created_at`)
SELECT UUID(), `nama`, NOW() FROM (
	SELECT DISTINCT TRIM(`tap`) AS `nama` FROM `mitra_outlets` WHERE TRIM(COALESCE(`tap`, '')) <> ''
	UNION
	SELECT DISTINCT TRIM(`tap`) AS `nama` FROM `mitra_salesforces` WHERE TRIM(COALESCE(`tap`, '')) <> ''
) AS `sumber`;--> statement-breakpoint
INSERT INTO `mitra_kabupatens` (`id`, `name`, `created_at`)
SELECT UUID(), `nama`, NOW() FROM (
	SELECT DISTINCT TRIM(`kabupaten`) AS `nama` FROM `mitra_outlets` WHERE TRIM(COALESCE(`kabupaten`, '')) <> ''
) AS `sumber`;--> statement-breakpoint
INSERT INTO `mitra_kecamatans` (`id`, `name`, `created_at`)
SELECT UUID(), `nama`, NOW() FROM (
	SELECT DISTINCT TRIM(`kecamatan`) AS `nama` FROM `mitra_outlets` WHERE TRIM(COALESCE(`kecamatan`, '')) <> ''
) AS `sumber`;