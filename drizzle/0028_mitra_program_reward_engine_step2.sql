ALTER TABLE `mitra_program_scores` DROP INDEX `mitra_program_scores_unique_idx`;--> statement-breakpoint
ALTER TABLE `mitra_program_scores` MODIFY COLUMN `achievement_date` date NOT NULL;--> statement-breakpoint
ALTER TABLE `mitra_program_scores` ADD CONSTRAINT `mitra_program_scores_unique_idx` UNIQUE(`program_id`,`outlet_id`,`param_id`,`achievement_date`);--> statement-breakpoint
ALTER TABLE `mitra_program_scores` DROP COLUMN `period_ym`;