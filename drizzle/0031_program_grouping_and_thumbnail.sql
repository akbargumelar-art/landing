DROP INDEX `mitra_program_leaderboard_rank_idx` ON `mitra_program_leaderboard`;--> statement-breakpoint
ALTER TABLE `mitra_program_leaderboard` ADD `group_key` varchar(160) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mitra_program_winners` ADD `group_key` varchar(160) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mitra_programs` ADD `group_by` enum('NONE','TAP','KABUPATEN','KECAMATAN') DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `mitra_programs` ADD `thumbnail_url` varchar(500);--> statement-breakpoint
CREATE INDEX `mitra_program_leaderboard_rank_idx` ON `mitra_program_leaderboard` (`program_id`,`group_key`,`rank`);