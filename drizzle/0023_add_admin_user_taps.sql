CREATE TABLE `admin_user_taps` (
	`user_id` varchar(36) NOT NULL,
	`tap` varchar(255) NOT NULL,
	CONSTRAINT `admin_user_taps_pk` PRIMARY KEY(`user_id`,`tap`)
);
--> statement-breakpoint
ALTER TABLE `admin_user_taps` ADD CONSTRAINT `admin_user_taps_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_user_taps_tap_idx` ON `admin_user_taps` (`tap`);