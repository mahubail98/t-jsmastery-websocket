CREATE TABLE `commentary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`minute` integer,
	`sequence` integer NOT NULL,
	`period` text,
	`event_type` text NOT NULL,
	`actor` text,
	`team` text,
	`message` text NOT NULL,
	`metadata` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commentary_match_id_sequence_key` ON `commentary` (`match_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sport` text NOT NULL,
	`home_team` text NOT NULL,
	`away_team` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`home_score` integer DEFAULT 0 NOT NULL,
	`away_score` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "matches_status_check" CHECK("matches"."status" in ('scheduled', 'live', 'finished'))
);
--> statement-breakpoint
CREATE INDEX `matches_status_start_time_idx` ON `matches` (`status`,`start_time`);