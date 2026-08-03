CREATE INDEX `form_submissions_form_idx` ON `form_submissions` (`form_id`);--> statement-breakpoint
CREATE INDEX `form_submissions_status_idx` ON `form_submissions` (`status`);--> statement-breakpoint
CREATE INDEX `form_submissions_submitted_idx` ON `form_submissions` (`submitted_at`);