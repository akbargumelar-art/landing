CREATE TABLE `program_winners` (
	`id` varchar(36) NOT NULL,
	`program_id` varchar(36) NOT NULL,
	`mode` enum('UNDIAN','PERFORMANCE') NOT NULL,
	`submission_id` varchar(36),
	`name` varchar(255) NOT NULL DEFAULT '',
	`phone` varchar(50) NOT NULL DEFAULT '',
	`outlet` varchar(255) NOT NULL DEFAULT '',
	`period` varchar(100) NOT NULL DEFAULT '',
	`photo_url` varchar(500) NOT NULL DEFAULT '',
	`prize_name` varchar(255) NOT NULL DEFAULT '',
	`drawn_at` datetime,
	`outlet_id` varchar(36),
	`rank` int,
	`is_published` boolean NOT NULL DEFAULT false,
	CONSTRAINT `program_winners_id` PRIMARY KEY(`id`),
	CONSTRAINT `program_winners_submission_idx` UNIQUE(`submission_id`)
);
--> statement-breakpoint
ALTER TABLE `programs` ADD `mode` enum('UNDIAN','PERFORMANCE') DEFAULT 'UNDIAN' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `mechanism_md` text;--> statement-breakpoint
ALTER TABLE `programs` ADD `period_start` datetime;--> statement-breakpoint
ALTER TABLE `programs` ADD `period_end` datetime;--> statement-breakpoint
ALTER TABLE `programs` ADD `ranking_mode` enum('POINT','RANK');--> statement-breakpoint
ALTER TABLE `programs` ADD `tie_breaker` varchar(120);--> statement-breakpoint
ALTER TABLE `programs` ADD `is_public` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `program_winners` ADD CONSTRAINT `program_winners_program_id_programs_id_fk` FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `program_winners_program_idx` ON `program_winners` (`program_id`);--> statement-breakpoint
CREATE INDEX `program_winners_mode_idx` ON `program_winners` (`mode`);--> statement-breakpoint
CREATE INDEX `program_winners_public_idx` ON `program_winners` (`is_published`);--> statement-breakpoint
CREATE INDEX `programs_mode_idx` ON `programs` (`mode`);--> statement-breakpoint
CREATE INDEX `programs_public_idx` ON `programs` (`is_public`);--> statement-breakpoint
-- ============================================================================
-- BACKFILL (prd-total-revamp.md 3.5 step 2-3). Additive only: mitra_programs,
-- winners, and mitra_program_winners are all left in place so this is reversible.
-- Re-runnable: every statement is guarded against double application.
--
-- NOT YET VERIFIED AGAINST A DATABASE. Run against a restored backup first and
-- then `node scripts/verify-program-migration.mjs` before touching production.
-- ============================================================================

-- 1. Every pre-existing program row is an UNDIAN program.
UPDATE `programs` SET `mode` = 'UNDIAN' WHERE `mode` IS NULL;--> statement-breakpoint

-- 2. Resolve slug collisions BEFORE inserting mitra rows.
-- `programs.slug` is UNIQUE, and legacy rows with category='mitra' intentionally shadow a
-- mitra program of the same slug (see docs/session.md: "program Mitra yang memiliki slug
-- sama menjadi sumber utama" - the public /program page already filters these out).
-- The mitra row must own the canonical slug, so the shadowed legacy row is renamed and
-- archived rather than deleted; no row is lost.
UPDATE `programs` p
JOIN `mitra_programs` mp ON mp.`slug` = p.`slug`
SET p.`slug` = CONCAT(p.`slug`, '-undian-legacy'),
    p.`status` = 'archived'
WHERE p.`category` = 'mitra'
  AND p.`mode` = 'UNDIAN';--> statement-breakpoint

-- 2b. Any remaining collision is NOT an expected shadow row, so it is disambiguated with
-- the row id to keep the migration from aborting on a duplicate key. The verification
-- script reports these so they can be reviewed by hand.
UPDATE `programs` p
JOIN `mitra_programs` mp ON mp.`slug` = p.`slug`
SET p.`slug` = CONCAT(p.`slug`, '-undian-', LEFT(p.`id`, 8))
WHERE p.`mode` = 'UNDIAN';--> statement-breakpoint

-- 3. Copy mitra_programs into programs, PRESERVING id so that the existing
-- mitra_program_params / participants / scores / leaderboard rows keep pointing at a
-- valid program id. (Repointing those FK constraints is a follow-up step, done only
-- after row counts are verified.)
INSERT INTO `programs`
    (`id`, `slug`, `title`, `description`, `thumbnail`, `category`, `period`, `content`,
     `terms`, `mechanics`, `gallery`, `prizes`, `status`, `sort_order`, `created_at`,
     `mode`, `mechanism_md`, `period_start`, `period_end`, `ranking_mode`, `tie_breaker`, `is_public`)
SELECT
    mp.`id`,
    mp.`slug`,
    mp.`name`,
    COALESCE(mp.`description_md`, ''),
    '',
    'mitra',
    '',
    '',
    '[]', '[]', '[]', '[]',
    LOWER(mp.`status`),
    0,
    mp.`created_at`,
    'PERFORMANCE',
    mp.`mechanism_md`,
    mp.`period_start`,
    mp.`period_end`,
    mp.`ranking_mode`,
    mp.`tie_breaker`,
    mp.`is_public`
FROM `mitra_programs` mp
WHERE NOT EXISTS (SELECT 1 FROM `programs` p WHERE p.`id` = mp.`id`);--> statement-breakpoint

-- 4. Copy undian winners into the unified table.
INSERT INTO `program_winners`
    (`id`, `program_id`, `mode`, `submission_id`, `name`, `phone`, `outlet`, `period`,
     `photo_url`, `prize_name`, `drawn_at`, `outlet_id`, `rank`, `is_published`)
SELECT
    w.`id`, w.`program_id`, 'UNDIAN', w.`submission_id`, w.`name`, w.`phone`, w.`outlet`,
    w.`period`, w.`photo_url`, w.`prize_name`, w.`drawn_at`, NULL, NULL, true
FROM `winners` w
WHERE NOT EXISTS (SELECT 1 FROM `program_winners` pw WHERE pw.`id` = w.`id`);--> statement-breakpoint

-- 5. Copy performance winners into the unified table.
INSERT INTO `program_winners`
    (`id`, `program_id`, `mode`, `submission_id`, `name`, `phone`, `outlet`, `period`,
     `photo_url`, `prize_name`, `drawn_at`, `outlet_id`, `rank`, `is_published`)
SELECT
    mw.`id`, mw.`program_id`, 'PERFORMANCE', NULL, '', '', '', '', '',
    COALESCE(mw.`prize_label`, ''), NULL, mw.`outlet_id`, mw.`rank`, mw.`is_published`
FROM `mitra_program_winners` mw
WHERE NOT EXISTS (SELECT 1 FROM `program_winners` pw WHERE pw.`id` = mw.`id`);