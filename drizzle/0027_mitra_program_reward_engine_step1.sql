CREATE TABLE `mitra_program_reward_rules` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`rule_type` enum('RANK','THRESHOLD') NOT NULL,
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
ALTER TABLE `mitra_program_scores` ADD `achievement_date` date;--> statement-breakpoint
ALTER TABLE `mitra_programs` ADD `mechanism_type` enum('RANKING','THRESHOLD','HYBRID') DEFAULT 'RANKING' NOT NULL;--> statement-breakpoint
ALTER TABLE `mitra_program_reward_rules` ADD CONSTRAINT `mitra_program_reward_rules_program_id_mitra_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `mitra_programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mitra_program_reward_rules_program_idx` ON `mitra_program_reward_rules` (`program_id`);--> statement-breakpoint
UPDATE `mitra_program_scores` SET `achievement_date` = STR_TO_DATE(CONCAT(`period_ym`, '-01'), '%Y-%m-%d') WHERE `achievement_date` IS NULL;