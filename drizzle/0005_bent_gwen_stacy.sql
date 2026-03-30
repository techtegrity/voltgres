CREATE TABLE `connection_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`database` text NOT NULL,
	`total` integer NOT NULL,
	`active` integer NOT NULL,
	`idle` integer NOT NULL,
	`sampled_at` integer NOT NULL
);
