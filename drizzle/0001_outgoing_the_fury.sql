CREATE TABLE IF NOT EXISTS `access_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`description` text DEFAULT '',
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pg_user_password` (
	`id` text PRIMARY KEY NOT NULL,
	`pg_username` text NOT NULL,
	`encrypted_password` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`database` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`size_bytes` integer,
	`storage_key` text,
	`error` text,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`backup_config_id` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `storage_config` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`bucket` text NOT NULL,
	`region` text DEFAULT 'us-east-1' NOT NULL,
	`endpoint` text,
	`access_key_id` text NOT NULL,
	`secret_access_key` text NOT NULL,
	`path_prefix` text DEFAULT '',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
