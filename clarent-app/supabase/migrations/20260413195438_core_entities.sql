CREATE TYPE "public"."contact_role" AS ENUM('primary', 'billing', 'compliance', 'on_site', 'emergency_coordinator', 'other');--> statement-breakpoint
CREATE TYPE "public"."generator_class" AS ENUM('VSQG', 'SQG', 'LQG');--> statement-breakpoint
CREATE TYPE "public"."generator_status" AS ENUM('prospect', 'active', 'inactive', 'suspended', 'do_not_contact');--> statement-breakpoint
CREATE TYPE "public"."marketing_stage" AS ENUM('prospect', 'contacted', 'engaged', 'customer');--> statement-breakpoint
CREATE TYPE "public"."service_area_type" AS ENUM('state', 'zip_prefix', 'radius_miles', 'polygon');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('prospect', 'onboarding', 'active', 'paused', 'suspended', 'removed');--> statement-breakpoint
CREATE TYPE "public"."vendor_type" AS ENUM('transporter', 'tsdf', 'transporter_tsdf', 'consolidation', 'broker');--> statement-breakpoint
CREATE TYPE "public"."waste_framework" AS ENUM('rcra_hazardous', 'universal_waste', 'used_oil', 'non_rcra_state', 'medical', 'asbestos', 'radioactive');--> statement-breakpoint
CREATE TABLE "generator_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generator_id" uuid NOT NULL,
	"location_id" uuid,
	"first_name" text,
	"last_name" text,
	"title" text,
	"email" text,
	"phone" text,
	"mobile" text,
	"role" "contact_role" DEFAULT 'primary' NOT NULL,
	"is_authorized_signer" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generator_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generator_id" uuid NOT NULL,
	"name" text NOT NULL,
	"epa_id" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text DEFAULT 'US' NOT NULL,
	"phone" text,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"dba" text,
	"generator_class" "generator_class",
	"naics_code" text,
	"industry" text,
	"website" text,
	"status" "generator_status" DEFAULT 'prospect' NOT NULL,
	"marketing_stage" "marketing_stage" DEFAULT 'prospect' NOT NULL,
	"account_notes" text,
	"enrichment_source" text,
	"last_enriched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"waste_framework" "waste_framework" NOT NULL,
	"waste_code_prefix" text,
	"container_types" text[],
	"max_quantity_per_pickup" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"area_type" "service_area_type" NOT NULL,
	"value" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"dba" text,
	"vendor_type" "vendor_type" NOT NULL,
	"epa_id" text,
	"dot_registration" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text DEFAULT 'US' NOT NULL,
	"phone" text,
	"email" text,
	"website" text,
	"status" "vendor_status" DEFAULT 'prospect' NOT NULL,
	"insurance_expires_at" date,
	"performance_score" numeric(5, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generator_contacts" ADD CONSTRAINT "generator_contacts_generator_id_generators_id_fk" FOREIGN KEY ("generator_id") REFERENCES "public"."generators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generator_contacts" ADD CONSTRAINT "generator_contacts_location_id_generator_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."generator_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generator_locations" ADD CONSTRAINT "generator_locations_generator_id_generators_id_fk" FOREIGN KEY ("generator_id") REFERENCES "public"."generators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_capabilities" ADD CONSTRAINT "vendor_capabilities_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_service_areas" ADD CONSTRAINT "vendor_service_areas_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generator_contacts_generator_id_idx" ON "generator_contacts" USING btree ("generator_id");--> statement-breakpoint
CREATE INDEX "generator_contacts_email_idx" ON "generator_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "generator_locations_generator_id_idx" ON "generator_locations" USING btree ("generator_id");--> statement-breakpoint
CREATE INDEX "generator_locations_state_idx" ON "generator_locations" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "generator_locations_epa_id_key" ON "generator_locations" USING btree ("epa_id") WHERE "generator_locations"."epa_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "generators_name_idx" ON "generators" USING btree ("name");--> statement-breakpoint
CREATE INDEX "generators_status_idx" ON "generators" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generators_marketing_stage_idx" ON "generators" USING btree ("marketing_stage");--> statement-breakpoint
CREATE INDEX "generators_generator_class_idx" ON "generators" USING btree ("generator_class");--> statement-breakpoint
CREATE INDEX "vendor_capabilities_vendor_id_idx" ON "vendor_capabilities" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_capabilities_framework_idx" ON "vendor_capabilities" USING btree ("waste_framework");--> statement-breakpoint
CREATE INDEX "vendor_service_areas_vendor_id_idx" ON "vendor_service_areas" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_service_areas_area_idx" ON "vendor_service_areas" USING btree ("area_type","value");--> statement-breakpoint
CREATE INDEX "vendors_status_idx" ON "vendors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vendors_vendor_type_idx" ON "vendors" USING btree ("vendor_type");--> statement-breakpoint
CREATE INDEX "vendors_name_idx" ON "vendors" USING btree ("name");
-- ============================================================================
-- updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "generators"           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "generator_locations"  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "generator_contacts"   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "vendors"              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "vendor_capabilities"  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "vendor_service_areas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
