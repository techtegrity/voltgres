ALTER TABLE `backup_config` ADD `pruning_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_config` ADD `retention_keep_last` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_config` ADD `retention_thin_keep_every` integer DEFAULT 30 NOT NULL;