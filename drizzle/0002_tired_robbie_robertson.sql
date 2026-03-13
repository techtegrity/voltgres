CREATE TABLE `query_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`database` text NOT NULL,
	`query` text NOT NULL,
	`command` text NOT NULL,
	`row_count` integer,
	`execution_time` integer,
	`columns` text,
	`result_preview` text,
	`error` text,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `query_log_config` (
	`id` text PRIMARY KEY NOT NULL,
	`database` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`retention_days` integer DEFAULT 7 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `query_log_config_database_unique` ON `query_log_config` (`database`);