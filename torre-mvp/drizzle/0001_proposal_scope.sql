ALTER TABLE `assessments` ADD `status` text DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE `assessments` ADD `homologated_by` text;
--> statement-breakpoint
ALTER TABLE `assessments` ADD `homologated_at` text;
--> statement-breakpoint
CREATE TABLE `annual_scenarios` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `year` integer NOT NULL,
  `name` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `source_year` integer,
  `version` integer DEFAULT 1 NOT NULL,
  `published_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `annual_scenarios_year_unique` ON `annual_scenarios` (`year`);
--> statement-breakpoint
CREATE TABLE `organization_units` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `company_code` text NOT NULL,
  `segment_code` text NOT NULL,
  `regional_code` text DEFAULT '00' NOT NULL,
  `composite_code` text NOT NULL,
  `description` text NOT NULL,
  `active` integer DEFAULT true NOT NULL,
  `valid_from` text NOT NULL,
  `valid_to` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_units_composite_code_unique` ON `organization_units` (`composite_code`);
--> statement-breakpoint
CREATE TABLE `indicator_assignments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `indicator_code` text NOT NULL,
  `user_name` text NOT NULL,
  `user_email` text NOT NULL,
  `role` text NOT NULL,
  `company_code` text,
  `can_edit_planned` integer DEFAULT false NOT NULL,
  `can_edit_actual` integer DEFAULT false NOT NULL,
  `can_homologate` integer DEFAULT false NOT NULL,
  `active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deadlines` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `year` integer NOT NULL,
  `month` integer NOT NULL,
  `indicator_code` text,
  `delivery_at` text NOT NULL,
  `validation_at` text,
  `committee_at` text,
  `release_at` text,
  `alert_days_before` integer DEFAULT 3 NOT NULL
);
