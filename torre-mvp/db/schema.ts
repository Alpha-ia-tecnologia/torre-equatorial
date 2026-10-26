import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const assessments = sqliteTable("assessments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: integer("external_id").notNull(),
  year: integer("year").notNull().default(2025),
  month: integer("month").notNull().default(10),
  indicatorCode: text("indicator_code").notNull(),
  indicatorName: text("indicator_name").notNull(),
  companyCode: text("company_code").notNull(),
  areaName: text("area_name").notNull(),
  planned: real("planned").notNull(),
  actual: real("actual"),
  score: real("score"),
  status: text("status").notNull().default("draft"),
  homologatedBy: text("homologated_by"),
  homologatedAt: text("homologated_at"),
  owner: text("owner").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const annualScenarios = sqliteTable("annual_scenarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  year: integer("year").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  sourceYear: integer("source_year"),
  version: integer("version").notNull().default(1),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const organizationUnits = sqliteTable("organization_units", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyCode: text("company_code").notNull(),
  segmentCode: text("segment_code").notNull(),
  regionalCode: text("regional_code").notNull().default("00"),
  compositeCode: text("composite_code").notNull().unique(),
  description: text("description").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to"),
});

export const indicatorAssignments = sqliteTable("indicator_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  indicatorCode: text("indicator_code").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  role: text("role").notNull(),
  companyCode: text("company_code"),
  canEditPlanned: integer("can_edit_planned", { mode: "boolean" }).notNull().default(false),
  canEditActual: integer("can_edit_actual", { mode: "boolean" }).notNull().default(false),
  canHomologate: integer("can_homologate", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const deadlines = sqliteTable("deadlines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  indicatorCode: text("indicator_code"),
  deliveryAt: text("delivery_at").notNull(),
  validationAt: text("validation_at"),
  committeeAt: text("committee_at"),
  releaseAt: text("release_at"),
  alertDaysBefore: integer("alert_days_before").notNull().default(3),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
