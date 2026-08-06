CREATE TABLE `admin_audit_logs` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`action` varchar(80) NOT NULL,
	`entity` varchar(120) NOT NULL,
	`entity_id` varchar(36),
	`diff_json` json,
	`ip` varchar(120),
	`created_at` datetime NOT NULL,
	CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_user_profiles` (
	`user_id` varchar(36) NOT NULL,
	`phone` varchar(50),
	`role` enum('SUPER_ADMIN','ADMIN_INPUT','MANAGER','SUPERVISOR','SALESFORCE') NOT NULL DEFAULT 'MANAGER',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime,
	`failed_login_attempts` int NOT NULL DEFAULT 0,
	`last_failed_login_at` datetime,
	`locked_until` datetime,
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_user_profiles_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `admin_user_territories` (
	`user_id` varchar(36) NOT NULL,
	`territory_id` varchar(36) NOT NULL,
	CONSTRAINT `admin_user_territories_pk` PRIMARY KEY(`user_id`,`territory_id`)
);
--> statement-breakpoint
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_user_profiles` ADD CONSTRAINT `admin_user_profiles_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_user_territories` ADD CONSTRAINT `admin_user_territories_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_user_territories` ADD CONSTRAINT `admin_user_territories_territory_id_mitra_territories_id_fk` FOREIGN KEY (`territory_id`) REFERENCES `mitra_territories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_audit_user_idx` ON `admin_audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `admin_audit_entity_idx` ON `admin_audit_logs` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `admin_audit_created_idx` ON `admin_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `admin_user_profiles_role_idx` ON `admin_user_profiles` (`role`);--> statement-breakpoint
CREATE INDEX `admin_user_territories_territory_idx` ON `admin_user_territories` (`territory_id`);--> statement-breakpoint
-- Backfill: setiap user existing mendapat baris admin_user_profiles.
-- Yang sudah punya profil di mitra_user_profiles di-mapping perannya:
--   MANAGER (kontrol penuh Portal Mitra) -> SUPER_ADMIN (kontrol penuh, lihat prd-total-revamp.md 2.1)
--   ADMIN   (input data Mitra)           -> ADMIN_INPUT
--   LEADER  (lihat & input area sendiri) -> SUPERVISOR
-- User yang belum pernah punya profil Mitra sama sekali (mis. akun admin non-Mitra) mendapat
-- default SUPER_ADMIN, karena itu persis perilaku aplikasi hari ini: setiap akun yang berhasil
-- login otomatis punya akses penuh. Super Admin bisa menurunkan role akun tsb lewat Kelola User
-- setelah migrasi ini selesai.
INSERT INTO `admin_user_profiles`
    (`user_id`, `phone`, `role`, `is_active`, `last_login_at`, `failed_login_attempts`, `last_failed_login_at`, `locked_until`, `created_at`, `updated_at`)
SELECT
    u.`id`,
    mup.`phone`,
    CASE mup.`role`
        WHEN 'MANAGER' THEN 'SUPER_ADMIN'
        WHEN 'ADMIN' THEN 'ADMIN_INPUT'
        WHEN 'LEADER' THEN 'SUPERVISOR'
        ELSE 'SUPER_ADMIN'
    END,
    COALESCE(mup.`is_active`, true),
    mup.`last_login_at`,
    COALESCE(mup.`failed_login_attempts`, 0),
    mup.`last_failed_login_at`,
    mup.`locked_until`,
    COALESCE(mup.`created_at`, NOW()),
    NOW()
FROM `user` u
LEFT JOIN `mitra_user_profiles` mup ON mup.`user_id` = u.`id`
-- Nama tabel WAJIB ditulis lengkap di sini. Tanpa itu MySQL 8 menolak seluruh statement
-- dengan ER_NON_UNIQ_ERROR ("Column 'user_id' in field list is ambiguous"), karena kolom
-- `user_id` ada baik di tabel tujuan maupun di `mitra_user_profiles` yang di-join.
-- Terbukti di uji runtime 2026-08-06: tanpa qualifier, backfill ini TIDAK PERNAH jalan dan
-- admin_user_profiles tetap kosong, sehingga seluruh admin selain akun bootstrap terkunci.
ON DUPLICATE KEY UPDATE `admin_user_profiles`.`user_id` = `admin_user_profiles`.`user_id`;--> statement-breakpoint
-- Backfill wilayah: salin penugasan wilayah Supervisor/Salesforce dari mitra_user_territories.
INSERT INTO `admin_user_territories` (`user_id`, `territory_id`)
SELECT mut.`user_id`, mut.`territory_id`
FROM `mitra_user_territories` mut
-- Sama seperti di atas: tanpa qualifier, ambigu terhadap `mitra_user_territories`.
ON DUPLICATE KEY UPDATE `admin_user_territories`.`user_id` = `admin_user_territories`.`user_id`;