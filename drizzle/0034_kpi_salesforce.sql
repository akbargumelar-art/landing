CREATE TABLE `mitra_kpi_outlet_scores` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`salesforce_id` varchar(36) NOT NULL,
	`outlet_id` varchar(36) NOT NULL,
	`param_id` varchar(36) NOT NULL,
	`raw_value` decimal(18,2) NOT NULL DEFAULT '0.00',
	`achievement_date` date NOT NULL,
	`batch_id` varchar(36),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_kpi_outlet_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_kpi_outlet_scores_unique_idx` UNIQUE(`program_id`,`outlet_id`,`param_id`,`achievement_date`)
);
--> statement-breakpoint
CREATE TABLE `mitra_kpi_results` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`participant_key` varchar(60) NOT NULL,
	`salesforce_id` varchar(36) NOT NULL,
	`tap` varchar(255) NOT NULL DEFAULT '',
	`compliance_score` decimal(8,2) NOT NULL DEFAULT '0.00',
	`performance_score` decimal(8,2) NOT NULL DEFAULT '0.00',
	`compliance_passed` boolean NOT NULL DEFAULT true,
	`benefit_type` enum('NONE','REWARD','PUNISHMENT') NOT NULL DEFAULT 'NONE',
	`benefit_label` varchar(255) NOT NULL DEFAULT '',
	`benefit_rule_id` varchar(36),
	`computed_at` datetime NOT NULL,
	CONSTRAINT `mitra_kpi_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_kpi_results_unique_idx` UNIQUE(`program_id`,`participant_key`)
);
--> statement-breakpoint
CREATE TABLE `mitra_kpi_targets` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`participant_key` varchar(60) NOT NULL,
	`salesforce_id` varchar(36) NOT NULL,
	`param_id` varchar(36) NOT NULL,
	`target_value` decimal(18,2) NOT NULL DEFAULT '0.00',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_kpi_targets_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_kpi_targets_unique_idx` UNIQUE(`program_id`,`participant_key`,`param_id`)
);
--> statement-breakpoint
ALTER TABLE `mitra_programs` MODIFY COLUMN `mechanism_type` enum('RACING','REWARD','KPI') NOT NULL DEFAULT 'RACING';--> statement-breakpoint
ALTER TABLE `mitra_program_params` ADD `kpi_category` enum('NONE','COMPLIANCE','PERFORMANCE') DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `mitra_program_params` ADD `achievement_cap` decimal(6,2);--> statement-breakpoint
ALTER TABLE `mitra_program_params` ADD `polarity` enum('HIGHER_BETTER','LOWER_BETTER') DEFAULT 'HIGHER_BETTER' NOT NULL;--> statement-breakpoint
ALTER TABLE `mitra_program_reward_rules` ADD `score_source` enum('TOTAL','COMPLIANCE','PERFORMANCE');--> statement-breakpoint
ALTER TABLE `mitra_program_reward_rules` ADD `benefit_type` enum('REWARD','PUNISHMENT','NONE');--> statement-breakpoint
ALTER TABLE `mitra_programs` ADD `kpi_compliance_min_score` decimal(6,2);--> statement-breakpoint
ALTER TABLE `mitra_programs` ADD `kpi_default_cap` decimal(6,2);--> statement-breakpoint
ALTER TABLE `mitra_programs` ADD `kpi_hide_punishment` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `mitra_kpi_outlet_scores` ADD CONSTRAINT `mitra_kpi_outlet_scores_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_kpi_outlet_scores` ADD CONSTRAINT `mitra_kpi_outlet_scores_salesforce_id_mitra_salesforces_id_fk` FOREIGN KEY (`salesforce_id`) REFERENCES `mitra_salesforces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_kpi_outlet_scores` ADD CONSTRAINT `mitra_kpi_outlet_scores_outlet_id_mitra_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `mitra_outlets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_kpi_outlet_scores` ADD CONSTRAINT `mitra_kpi_outlet_scores_param_id_mitra_program_params_id_fk` FOREIGN KEY (`param_id`) REFERENCES `mitra_program_params`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_kpi_outlet_scores` ADD CONSTRAINT `mitra_kpi_outlet_scores_batch_id_mitra_import_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `mitra_import_batches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_kpi_results` ADD CONSTRAINT `mitra_kpi_results_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_kpi_results` ADD CONSTRAINT `mitra_kpi_results_salesforce_id_mitra_salesforces_id_fk` FOREIGN KEY (`salesforce_id`) REFERENCES `mitra_salesforces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_kpi_targets` ADD CONSTRAINT `mitra_kpi_targets_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_kpi_targets` ADD CONSTRAINT `mitra_kpi_targets_salesforce_id_mitra_salesforces_id_fk` FOREIGN KEY (`salesforce_id`) REFERENCES `mitra_salesforces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mitra_kpi_targets` ADD CONSTRAINT `mitra_kpi_targets_param_id_mitra_program_params_id_fk` FOREIGN KEY (`param_id`) REFERENCES `mitra_program_params`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mitra_kpi_outlet_scores_sf_idx` ON `mitra_kpi_outlet_scores` (`program_id`,`salesforce_id`);--> statement-breakpoint
CREATE INDEX `mitra_kpi_outlet_scores_batch_idx` ON `mitra_kpi_outlet_scores` (`batch_id`);--> statement-breakpoint
CREATE INDEX `mitra_kpi_results_tap_idx` ON `mitra_kpi_results` (`program_id`,`tap`);--> statement-breakpoint
CREATE INDEX `mitra_kpi_targets_sf_idx` ON `mitra_kpi_targets` (`salesforce_id`);
