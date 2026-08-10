-- Urutan drop mengikuti arah foreign key: tabel anak lebih dulu, induknya terakhir.
-- Urutan alfabet bawaan generator menghapus mitra_program_params sebelum
-- mitra_program_scores, padahal scores masih memegang FK ke params.
DROP TABLE `mitra_program_scores`;--> statement-breakpoint
DROP TABLE `mitra_program_leaderboard`;--> statement-breakpoint
DROP TABLE `mitra_program_participants`;--> statement-breakpoint
DROP TABLE `mitra_program_winners`;--> statement-breakpoint
DROP TABLE `mitra_program_reward_rules`;--> statement-breakpoint
DROP TABLE `mitra_program_params`;--> statement-breakpoint
DROP TABLE `mitra_programs`;
