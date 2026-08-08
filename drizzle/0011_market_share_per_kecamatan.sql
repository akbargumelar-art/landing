CREATE TABLE `mitra_market_shares` (
	`id` varchar(36) NOT NULL,
	`kabupaten` varchar(255) NOT NULL,
	`kecamatan` varchar(255) NOT NULL,
	`telkomsel` decimal(5,2) NOT NULL DEFAULT '0.00',
	`xl` decimal(5,2) NOT NULL DEFAULT '0.00',
	`axis` decimal(5,2) NOT NULL DEFAULT '0.00',
	`smartfren` decimal(5,2) NOT NULL DEFAULT '0.00',
	`indosat` decimal(5,2) NOT NULL DEFAULT '0.00',
	`tri` decimal(5,2) NOT NULL DEFAULT '0.00',
	`created_at` datetime NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mitra_market_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `mitra_market_share_area_idx` UNIQUE(`kabupaten`,`kecamatan`)
);
