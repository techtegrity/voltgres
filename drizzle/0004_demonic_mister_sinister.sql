CREATE TABLE `alert` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`role_name` text,
	`message` text NOT NULL,
	`current_value` integer NOT NULL,
	`threshold` integer NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`resolved_at` integer,
	`created_at` integer NOT NULL
);
