ALTER TABLE `programs` ADD `wa_template` text;--> statement-breakpoint
ALTER TABLE `programs` ADD `wa_notify_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Pindahkan template lama ke tiap program undian. Sebelumnya satu setting `wa_gw_template`
-- dipakai bersama oleh notifikasi undian dan OTP Portal Mitra, padahal placeholder-nya
-- berbeda ({nama}/{program} vs {otp}/{outlet}/{expires}), sehingga salah satunya selalu
-- mengirim pesan dengan placeholder yang tidak terisi.
--
-- Template lama hanya diwariskan bila memang berformat undian; template ber-{otp} dibiarkan
-- untuk dipakai sebagai template OTP.
UPDATE `programs` p
SET p.`wa_template` = (
    SELECT s.`value` FROM `site_settings` s WHERE s.`key` = 'wa_gw_template' LIMIT 1
)
WHERE p.`mode` = 'UNDIAN'
  AND EXISTS (
      SELECT 1 FROM `site_settings` s
      WHERE s.`key` = 'wa_gw_template'
        AND TRIM(s.`value`) <> ''
        AND s.`value` NOT LIKE '%{otp}%'
  );--> statement-breakpoint
-- Setting OTP terpisah, diisi dari template lama bila memang berformat OTP.
INSERT INTO `site_settings` (`id`, `key`, `value`, `type`)
SELECT UUID(), 'wa_otp_template', s.`value`, 'text'
FROM `site_settings` s
WHERE s.`key` = 'wa_gw_template'
  AND s.`value` LIKE '%{otp}%'
  AND NOT EXISTS (SELECT 1 FROM `site_settings` x WHERE x.`key` = 'wa_otp_template');