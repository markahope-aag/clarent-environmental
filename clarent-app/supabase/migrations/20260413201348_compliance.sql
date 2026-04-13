CREATE TYPE "public"."calendar_entry_status" AS ENUM('upcoming', 'due_soon', 'overdue', 'completed', 'dismissed', 'waived');--> statement-breakpoint
CREATE TYPE "public"."deadline_type" AS ENUM('fixed_date', 'rolling_from_accumulation_start', 'annual', 'biennial', 'on_change', 'on_generation');--> statement-breakpoint
CREATE TYPE "public"."manifest_state" AS ENUM('draft', 'submitted', 'transporter_signed', 'tsdf_signed', 'completed', 'rejected', 'amended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."non_compliant_pathway" AS ENUM('reclassify', 'return_to_generator', 'emergency_pickup', 'on_site_stabilization', 'pending_decision');--> statement-breakpoint
CREATE TYPE "public"."non_compliant_state" AS ENUM('reported', 'investigating', 'awaiting_generator_approval', 'remedial_in_progress', 'resolved', 'disputed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."obligation_type" AS ENUM('accumulation_limit', 'biennial_report', 'annual_training', 'generator_fee', 'contingency_plan_review', 'emergency_coordinator_review', 'inspection_readiness', 'ldr_notification', 'epa_id_registration', 'state_specific');--> statement-breakpoint
CREATE TYPE "public"."unit_of_measure" AS ENUM('pounds', 'kilograms', 'gallons', 'liters', 'cubic_yards', 'tons');--> statement-breakpoint
CREATE TABLE "compliance_calendar_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generator_id" uuid NOT NULL,
	"generator_location_id" uuid,
	"obligation_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"citation" text,
	"due_at" timestamp with time zone NOT NULL,
	"status" "calendar_entry_status" DEFAULT 'upcoming' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generator_id" uuid NOT NULL,
	"generator_location_id" uuid,
	"obligation_type" "obligation_type" NOT NULL,
	"waste_framework" "waste_framework",
	"waste_stream_key" text,
	"title" text NOT NULL,
	"description" text,
	"citation" text,
	"deadline_type" "deadline_type" NOT NULL,
	"deadline_days" integer,
	"state" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"manifest_tracking_number" text,
	"state" "manifest_state" DEFAULT 'draft' NOT NULL,
	"generator_epa_id" text NOT NULL,
	"transporter_epa_id" text,
	"tsdf_epa_id" text,
	"waste_codes" text[],
	"container_count" integer,
	"total_quantity" numeric(12, 3),
	"unit_of_measure" "unit_of_measure",
	"submitted_at" timestamp with time zone,
	"generator_signed_at" timestamp with time zone,
	"transporter_signed_at" timestamp with time zone,
	"tsdf_signed_at" timestamp with time zone,
	"rejection_reason" text,
	"cdx_submission_id" text,
	"pdf_url" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "non_compliant_waste_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"generator_id" uuid NOT NULL,
	"reporting_vendor_id" uuid NOT NULL,
	"reported_by_contact" text,
	"declared" text NOT NULL,
	"found" text NOT NULL,
	"assessment" text,
	"recommended_pathway" "non_compliant_pathway" DEFAULT 'pending_decision' NOT NULL,
	"chosen_pathway" "non_compliant_pathway",
	"state" "non_compliant_state" DEFAULT 'reported' NOT NULL,
	"quoted_remedial_cost" numeric(12, 2),
	"remedial_vendor_id" uuid,
	"remedial_job_id" uuid,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_notes" text,
	"photos" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_calendar_entries" ADD CONSTRAINT "compliance_calendar_entries_generator_id_generators_id_fk" FOREIGN KEY ("generator_id") REFERENCES "public"."generators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_calendar_entries" ADD CONSTRAINT "compliance_calendar_entries_generator_location_id_generator_locations_id_fk" FOREIGN KEY ("generator_location_id") REFERENCES "public"."generator_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_calendar_entries" ADD CONSTRAINT "compliance_calendar_entries_obligation_id_compliance_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."compliance_obligations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_obligations" ADD CONSTRAINT "compliance_obligations_generator_id_generators_id_fk" FOREIGN KEY ("generator_id") REFERENCES "public"."generators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_obligations" ADD CONSTRAINT "compliance_obligations_generator_location_id_generator_locations_id_fk" FOREIGN KEY ("generator_location_id") REFERENCES "public"."generator_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_compliant_waste_events" ADD CONSTRAINT "non_compliant_waste_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_compliant_waste_events" ADD CONSTRAINT "non_compliant_waste_events_generator_id_generators_id_fk" FOREIGN KEY ("generator_id") REFERENCES "public"."generators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_compliant_waste_events" ADD CONSTRAINT "non_compliant_waste_events_reporting_vendor_id_vendors_id_fk" FOREIGN KEY ("reporting_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_compliant_waste_events" ADD CONSTRAINT "non_compliant_waste_events_remedial_vendor_id_vendors_id_fk" FOREIGN KEY ("remedial_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_compliant_waste_events" ADD CONSTRAINT "non_compliant_waste_events_remedial_job_id_jobs_id_fk" FOREIGN KEY ("remedial_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compliance_calendar_generator_id_idx" ON "compliance_calendar_entries" USING btree ("generator_id");--> statement-breakpoint
CREATE INDEX "compliance_calendar_due_at_idx" ON "compliance_calendar_entries" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "compliance_calendar_status_idx" ON "compliance_calendar_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "compliance_calendar_obligation_id_idx" ON "compliance_calendar_entries" USING btree ("obligation_id");--> statement-breakpoint
CREATE INDEX "compliance_obligations_generator_id_idx" ON "compliance_obligations" USING btree ("generator_id");--> statement-breakpoint
CREATE INDEX "compliance_obligations_location_id_idx" ON "compliance_obligations" USING btree ("generator_location_id");--> statement-breakpoint
CREATE INDEX "compliance_obligations_type_idx" ON "compliance_obligations" USING btree ("obligation_type");--> statement-breakpoint
CREATE INDEX "compliance_obligations_active_idx" ON "compliance_obligations" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "manifests_tracking_number_key" ON "manifests" USING btree ("manifest_tracking_number") WHERE "manifests"."manifest_tracking_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "manifests_job_id_idx" ON "manifests" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "manifests_state_idx" ON "manifests" USING btree ("state");--> statement-breakpoint
CREATE INDEX "manifests_generator_epa_id_idx" ON "manifests" USING btree ("generator_epa_id");--> statement-breakpoint
CREATE INDEX "non_compliant_job_id_idx" ON "non_compliant_waste_events" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "non_compliant_generator_id_idx" ON "non_compliant_waste_events" USING btree ("generator_id");--> statement-breakpoint
CREATE INDEX "non_compliant_state_idx" ON "non_compliant_waste_events" USING btree ("state");--> statement-breakpoint
CREATE INDEX "non_compliant_reported_at_idx" ON "non_compliant_waste_events" USING btree ("reported_at");
-- ============================================================================
-- updated_at triggers
-- ============================================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "compliance_obligations"       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "compliance_calendar_entries"  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "non_compliant_waste_events"   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "manifests"                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
