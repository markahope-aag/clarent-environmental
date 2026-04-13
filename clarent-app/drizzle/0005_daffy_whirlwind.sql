CREATE TYPE "public"."actor_type" AS ENUM('system', 'user_generator', 'user_vendor', 'user_ops', 'service_role', 'workflow', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('insert', 'update', 'delete', 'state_transition', 'login', 'export', 'manual_override');--> statement-breakpoint
CREATE TYPE "public"."communication_channel" AS ENUM('email', 'sms', 'portal_notification', 'phone', 'slack', 'webhook', 'letter');--> statement-breakpoint
CREATE TYPE "public"."communication_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."communication_state" AS ENUM('queued', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'replied');--> statement-breakpoint
CREATE TYPE "public"."document_access_policy" AS ENUM('generator_visible', 'vendor_visible', 'ops_only', 'public');--> statement-breakpoint
CREATE TYPE "public"."document_related_type" AS ENUM('job', 'generator', 'generator_location', 'vendor', 'invoice', 'manifest', 'certification', 'rfq', 'vendor_quote', 'non_compliant_event');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('intake_photo', 'sds', 'vendor_license', 'vendor_insurance_certificate', 'vendor_permit', 'invoice_pdf', 'manifest_pdf', 'certificate_of_disposal', 'ldr_notification', 'land_ban_certification', 'work_order', 'quote_pdf', 'generator_certification', 'pickup_confirmation', 'non_compliant_report', 'misc');--> statement-breakpoint
CREATE TYPE "public"."incident_category" AS ENUM('workflow_failure', 'payment_failure', 'vendor_no_response', 'non_compliant_waste', 'system_error', 'manual_override', 'dispute', 'data_quality', 'security', 'cdx_submission_error');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_state" AS ENUM('open', 'acknowledged', 'investigating', 'resolved', 'wont_fix');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text,
	"actor_label" text,
	"diff" jsonb,
	"metadata" jsonb,
	"reason" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "communication_channel" NOT NULL,
	"direction" "communication_direction" DEFAULT 'outbound' NOT NULL,
	"related_job_id" uuid,
	"related_generator_id" uuid,
	"related_vendor_id" uuid,
	"template_key" text,
	"subject" text,
	"body" text,
	"recipient" text NOT NULL,
	"sender" text,
	"state" "communication_state" DEFAULT 'queued' NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"related_type" "document_related_type" NOT NULL,
	"related_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"name" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"storage_bucket" text NOT NULL,
	"storage_path" text NOT NULL,
	"access_policy" "document_access_policy" DEFAULT 'ops_only' NOT NULL,
	"uploaded_by_actor_type" "actor_type",
	"uploaded_by_actor_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"superseded_by_document_id" uuid,
	"retention_until" date,
	"sha256" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "incident_category" NOT NULL,
	"severity" "incident_severity" DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"related_entity_type" text,
	"related_entity_id" uuid,
	"state" "incident_state" DEFAULT 'open' NOT NULL,
	"assigned_to" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communication_log" ADD CONSTRAINT "communication_log_related_job_id_jobs_id_fk" FOREIGN KEY ("related_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_log" ADD CONSTRAINT "communication_log_related_generator_id_generators_id_fk" FOREIGN KEY ("related_generator_id") REFERENCES "public"."generators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_log" ADD CONSTRAINT "communication_log_related_vendor_id_vendors_id_fk" FOREIGN KEY ("related_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "comm_log_job_id_idx" ON "communication_log" USING btree ("related_job_id");--> statement-breakpoint
CREATE INDEX "comm_log_generator_id_idx" ON "communication_log" USING btree ("related_generator_id");--> statement-breakpoint
CREATE INDEX "comm_log_vendor_id_idx" ON "communication_log" USING btree ("related_vendor_id");--> statement-breakpoint
CREATE INDEX "comm_log_channel_idx" ON "communication_log" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "comm_log_state_idx" ON "communication_log" USING btree ("state");--> statement-breakpoint
CREATE INDEX "comm_log_template_key_idx" ON "communication_log" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "comm_log_provider_message_id_idx" ON "communication_log" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "documents_related_idx" ON "documents" USING btree ("related_type","related_id");--> statement-breakpoint
CREATE INDEX "documents_document_type_idx" ON "documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "documents_access_policy_idx" ON "documents" USING btree ("access_policy");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_storage_path_key" ON "documents" USING btree ("storage_bucket","storage_path");--> statement-breakpoint
CREATE INDEX "incidents_category_idx" ON "incidents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "incidents_severity_idx" ON "incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "incidents_state_idx" ON "incidents" USING btree ("state");--> statement-breakpoint
CREATE INDEX "incidents_related_entity_idx" ON "incidents" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "incidents_detected_at_idx" ON "incidents" USING btree ("detected_at");