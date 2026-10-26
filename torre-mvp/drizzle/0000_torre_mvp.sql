CREATE TABLE `assessments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `external_id` integer NOT NULL,
  `year` integer DEFAULT 2025 NOT NULL,
  `month` integer DEFAULT 10 NOT NULL,
  `indicator_code` text NOT NULL,
  `indicator_name` text NOT NULL,
  `company_code` text NOT NULL,
  `area_name` text NOT NULL,
  `planned` real NOT NULL,
  `actual` real,
  `score` real,
  `owner` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessments_external_id_unique` ON `assessments` (`external_id`);
--> statement-breakpoint
CREATE TABLE `audit_log` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `actor` text NOT NULL,
  `action` text NOT NULL,
  `entity` text NOT NULL,
  `previous_value` text,
  `new_value` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
