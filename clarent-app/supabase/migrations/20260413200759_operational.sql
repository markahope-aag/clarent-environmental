CREATE TYPE "public"."job_lane" AS ENUM('lane_1', 'lane_2');--> statement-breakpoint
CREATE TYPE "public"."job_state" AS ENUM('draft', 'classified_standard', 'classified_complex', 'priced', 'quote_sent', 'quote_accepted', 'advance_paid', 'vendor_selected', 'vendor_notified', 'pickup_scheduled', 'balance_due', 'balance_paid', 'pickup_completed', 'documents_processing', 'completed', 'non_compliant_flagged', 'disputed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."quote_state" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."rfq_recipient_state" AS ENUM('pending', 'opened', 'responded', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."rfq_state" AS ENUM('open', 'closed', 'awarded', 'cancelled');--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"generator_id" uuid NOT NULL,
	"generator_contact_id" uuid,
	"template_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_waste_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"waste_stream_key" text NOT NULL,
	"waste_code_prefixes" text[],
	"container_type" text NOT NULL,
	"container_count" integer NOT NULL,
	"estimated_weight_lbs" numeric(10, 2),
	"container_condition" text,
	"un_container_certified" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" text NOT NULL,
	"generator_id" uuid NOT NULL,
	"generator_location_id" uuid NOT NULL,
	"generator_contact_id" uuid,
	"state" "job_state" DEFAULT 'draft' NOT NULL,
	"lane" "job_lane",
	"waste_framework" "waste_framework",
	"classification_confidence" numeric(5, 2),
	"requested_pickup_window" text,
	"scheduled_pickup_date" timestamp with time zone,
	"actual_pickup_date" timestamp with time zone,
	"estimated_total" numeric(12, 2),
	"final_total" numeric(12, 2),
	"deposit_amount" numeric(12, 2),
	"balance_amount" numeric(12, 2),
	"selected_vendor_id" uuid,
	"flags" text[],
	"notes" text,
	"state_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"vendor_quote_id" uuid,
	"state" "quote_state" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"fees" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"deposit_percent" numeric(5, 2) DEFAULT '60' NOT NULL,
	"line_items" jsonb NOT NULL,
	"terms_version" integer NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfq_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"state" "rfq_recipient_state" DEFAULT 'pending' NOT NULL,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"decline_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"reference_number" text NOT NULL,
	"anonymized_payload" jsonb NOT NULL,
	"state" "rfq_state" DEFAULT 'open' NOT NULL,
	"response_deadline_at" timestamp with time zone NOT NULL,
	"awarded_vendor_quote_id" uuid,
	"awarded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"rfq_recipient_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"per_unit_price" numeric(12, 2),
	"minimum_job_charge" numeric(12, 2),
	"stop_fee" numeric(12, 2),
	"fuel_surcharge" numeric(12, 2),
	"other_fees" numeric(12, 2),
	"total_estimate" numeric(12, 2) NOT NULL,
	"earliest_pickup_date" date,
	"conditions" text,
	"line_items" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_generator_id_generators_id_fk" FOREIGN KEY ("generator_id") REFERENCES "public"."generators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_generator_contact_id_generator_contacts_id_fk" FOREIGN KEY ("generator_contact_id") REFERENCES "public"."generator_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_waste_streams" ADD CONSTRAINT "job_waste_streams_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_generator_id_generators_id_fk" FOREIGN KEY ("generator_id") REFERENCES "public"."generators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_generator_location_id_generator_locations_id_fk" FOREIGN KEY ("generator_location_id") REFERENCES "public"."generator_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_generator_contact_id_generator_contacts_id_fk" FOREIGN KEY ("generator_contact_id") REFERENCES "public"."generator_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_selected_vendor_id_vendors_id_fk" FOREIGN KEY ("selected_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vendor_quote_id_vendor_quotes_id_fk" FOREIGN KEY ("vendor_quote_id") REFERENCES "public"."vendor_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_recipients" ADD CONSTRAINT "rfq_recipients_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_recipients" ADD CONSTRAINT "rfq_recipients_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_rfq_recipient_id_rfq_recipients_id_fk" FOREIGN KEY ("rfq_recipient_id") REFERENCES "public"."rfq_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certifications_job_id_idx" ON "certifications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "certifications_generator_id_idx" ON "certifications" USING btree ("generator_id");--> statement-breakpoint
CREATE INDEX "certifications_signed_at_idx" ON "certifications" USING btree ("signed_at");--> statement-breakpoint
CREATE INDEX "job_waste_streams_job_id_idx" ON "job_waste_streams" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_waste_streams_waste_stream_key_idx" ON "job_waste_streams" USING btree ("waste_stream_key");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_reference_number_key" ON "jobs" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "jobs_generator_id_idx" ON "jobs" USING btree ("generator_id");--> statement-breakpoint
CREATE INDEX "jobs_generator_location_id_idx" ON "jobs" USING btree ("generator_location_id");--> statement-breakpoint
CREATE INDEX "jobs_selected_vendor_id_idx" ON "jobs" USING btree ("selected_vendor_id");--> statement-breakpoint
CREATE INDEX "jobs_state_idx" ON "jobs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "jobs_lane_idx" ON "jobs" USING btree ("lane");--> statement-breakpoint
CREATE INDEX "jobs_state_changed_at_idx" ON "jobs" USING btree ("state_changed_at");--> statement-breakpoint
CREATE INDEX "jobs_created_at_idx" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "quotes_job_id_idx" ON "quotes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "quotes_state_idx" ON "quotes" USING btree ("state");--> statement-breakpoint
CREATE INDEX "quotes_valid_until_idx" ON "quotes" USING btree ("valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "rfq_recipients_rfq_vendor_key" ON "rfq_recipients" USING btree ("rfq_id","vendor_id");--> statement-breakpoint
CREATE INDEX "rfq_recipients_vendor_id_idx" ON "rfq_recipients" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "rfq_recipients_state_idx" ON "rfq_recipients" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "rfqs_reference_number_key" ON "rfqs" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "rfqs_job_id_idx" ON "rfqs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "rfqs_state_idx" ON "rfqs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "rfqs_response_deadline_at_idx" ON "rfqs" USING btree ("response_deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_quotes_recipient_key" ON "vendor_quotes" USING btree ("rfq_recipient_id");--> statement-breakpoint
CREATE INDEX "vendor_quotes_rfq_id_idx" ON "vendor_quotes" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX "vendor_quotes_vendor_id_idx" ON "vendor_quotes" USING btree ("vendor_id");
-- ============================================================================
-- updated_at triggers (set_updated_at() function already exists from core_entities migration)
-- ============================================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "jobs"              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "job_waste_streams" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "rfqs"              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "rfq_recipients"    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "vendor_quotes"     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "quotes"            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- certifications intentionally has no updated_at (append-only audit record)

-- ============================================================================
-- state_changed_at trigger — updates jobs.state_changed_at when state changes
-- ============================================================================

CREATE OR REPLACE FUNCTION set_job_state_changed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    NEW.state_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_state_changed_at BEFORE UPDATE ON "jobs"
FOR EACH ROW EXECUTE FUNCTION set_job_state_changed_at();
