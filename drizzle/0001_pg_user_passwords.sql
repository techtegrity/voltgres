CREATE TABLE `pg_user_password` (
	`id` text PRIMARY KEY NOT NULL,
	`pg_username` text NOT NULL,
	`encrypted_password` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
