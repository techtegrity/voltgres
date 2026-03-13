CREATE TABLE `storage_config` (
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
