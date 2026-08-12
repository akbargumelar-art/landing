ALTER TABLE `mitra_outlets` DROP FOREIGN KEY `mitra_outlets_territory_id_mitra_territories_id_fk`;
--> statement-breakpoint
DROP TABLE `admin_user_territories`;--> statement-breakpoint
DROP TABLE `mitra_user_territories`;--> statement-breakpoint
DROP TABLE `mitra_territories`;--> statement-breakpoint
DROP INDEX `mitra_outlets_territory_idx` ON `mitra_outlets`;--> statement-breakpoint
CREATE INDEX `mitra_outlets_tap_idx` ON `mitra_outlets` (`tap`);--> statement-breakpoint
ALTER TABLE `mitra_outlets` DROP COLUMN `territory_id`;
