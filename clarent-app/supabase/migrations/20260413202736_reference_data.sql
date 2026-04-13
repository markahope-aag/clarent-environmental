SET search_path TO public;--> statement-breakpoint
CREATE TYPE "public"."characteristic_type" AS ENUM('ignitability', 'corrosivity', 'reactivity', 'toxicity', 'physical_state', 'compatibility');--> statement-breakpoint
CREATE TYPE "public"."conflict_resolution_method" AS ENUM('federal_wins', 'state_wins', 'more_stringent_wins', 'dual_requirement');--> statement-breakpoint
CREATE TYPE "public"."lane_eligibility" AS ENUM('lane_1', 'lane_2', 'both');--> statement-breakpoint
CREATE TYPE "public"."regulation_source" AS ENUM('federal_cfr', 'state_statute', 'state_regulation', 'epa_guidance', 'dot', 'osha', 'tribal');--> statement-breakpoint
CREATE TYPE "public"."state_overlay_type" AS ENUM('state_waste_code', 'stricter_rule', 'additional_requirement', 'exemption');--> statement-breakpoint
CREATE TYPE "public"."transport_mode" AS ENUM('road', 'rail', 'air', 'water');--> statement-breakpoint
CREATE TYPE "public"."waste_code_series" AS ENUM('D', 'F', 'K', 'P', 'U');--> statement-breakpoint
CREATE TABLE "chemicals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cas_number" text NOT NULL,
	"name" text NOT NULL,
	"synonyms" text[],
	"molecular_formula" text,
	"flash_point_c" numeric(8, 2),
	"boiling_point_c" numeric(8, 2),
	"likely_waste_codes" text[],
	"hazard_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflict_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federal_requirement_id" uuid,
	"state" text NOT NULL,
	"state_rule_description" text NOT NULL,
	"resolution" "conflict_resolution_method" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dot_hazmat_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proper_shipping_name" text NOT NULL,
	"un_number" text,
	"hazard_class" text NOT NULL,
	"subsidiary_hazards" text[],
	"packing_group" text,
	"labels" text[],
	"special_provisions" text[],
	"excepted_quantities" text,
	"packaging_exceptions" text,
	"packaging_non_bulk" text,
	"packaging_bulk" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jurisdiction_matrix" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"state_name" text NOT NULL,
	"rcra_authorized" boolean DEFAULT false NOT NULL,
	"epa_region" text,
	"state_agency" text,
	"agency_url" text,
	"biennial_report_required" boolean DEFAULT false NOT NULL,
	"biennial_report_deadline" text,
	"fee_schedule_notes" text,
	"manifest_notes" text,
	"last_reviewed" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "label_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waste_code" text NOT NULL,
	"required_labels" text[] NOT NULL,
	"transport_mode" "transport_mode" DEFAULT 'road' NOT NULL,
	"citation" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "land_disposal_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waste_code" text NOT NULL,
	"treatment_standard" text NOT NULL,
	"regulated_constituents" text[],
	"citation" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "placard_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hazard_class" text NOT NULL,
	"threshold_pounds" numeric(12, 2),
	"placard_type" text NOT NULL,
	"requires_placard" boolean DEFAULT true NOT NULL,
	"citation" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "regulation_source" NOT NULL,
	"jurisdiction" text NOT NULL,
	"citation" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"effective_date" date,
	"amended_date" date,
	"superseded_by" uuid,
	"summary" text,
	"full_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"regulation_id" uuid NOT NULL,
	"requirement_type" "public"."obligation_type" NOT NULL,
	"description" text NOT NULL,
	"applies_to_generator_classes" text[],
	"applies_to_waste_frameworks" text[],
	"jurisdiction" text NOT NULL,
	"deadline_days" integer,
	"citation" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_overlays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"overlay_type" "state_overlay_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"citation" text,
	"applies_to_waste_framework" "public"."waste_framework",
	"effective_from" date,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waste_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"series" "waste_code_series" NOT NULL,
	"description" text NOT NULL,
	"listing_basis" text,
	"hazard_codes" text[],
	"citation" text,
	"is_acute_hazardous" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waste_frameworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" "public"."waste_framework" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"citation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waste_stream_characteristics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waste_stream_id" uuid NOT NULL,
	"characteristic" characteristic_type NOT NULL,
	"value" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waste_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"waste_framework" "public"."waste_framework" NOT NULL,
	"typical_waste_codes" text[],
	"lane_eligibility" "lane_eligibility" DEFAULT 'lane_2' NOT NULL,
	"industry_hints" text[],
	"typical_container_types" text[],
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conflict_resolutions" ADD CONSTRAINT "conflict_resolutions_federal_requirement_id_regulatory_requirements_id_fk" FOREIGN KEY ("federal_requirement_id") REFERENCES "public"."regulatory_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_requirements" ADD CONSTRAINT "regulatory_requirements_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_stream_characteristics" ADD CONSTRAINT "waste_stream_characteristics_waste_stream_id_waste_streams_id_fk" FOREIGN KEY ("waste_stream_id") REFERENCES "public"."waste_streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chemicals_cas_number_key" ON "chemicals" USING btree ("cas_number");--> statement-breakpoint
CREATE INDEX "chemicals_name_idx" ON "chemicals" USING btree ("name");--> statement-breakpoint
CREATE INDEX "conflict_resolutions_federal_requirement_id_idx" ON "conflict_resolutions" USING btree ("federal_requirement_id");--> statement-breakpoint
CREATE INDEX "conflict_resolutions_state_idx" ON "conflict_resolutions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "dot_hazmat_un_number_idx" ON "dot_hazmat_table" USING btree ("un_number");--> statement-breakpoint
CREATE INDEX "dot_hazmat_hazard_class_idx" ON "dot_hazmat_table" USING btree ("hazard_class");--> statement-breakpoint
CREATE INDEX "dot_hazmat_proper_shipping_name_idx" ON "dot_hazmat_table" USING btree ("proper_shipping_name");--> statement-breakpoint
CREATE UNIQUE INDEX "jurisdiction_matrix_state_key" ON "jurisdiction_matrix" USING btree ("state");--> statement-breakpoint
CREATE INDEX "label_requirements_waste_code_idx" ON "label_requirements" USING btree ("waste_code");--> statement-breakpoint
CREATE INDEX "ldr_waste_code_idx" ON "land_disposal_restrictions" USING btree ("waste_code");--> statement-breakpoint
CREATE INDEX "placard_requirements_hazard_class_idx" ON "placard_requirements" USING btree ("hazard_class");--> statement-breakpoint
CREATE INDEX "regulations_source_idx" ON "regulations" USING btree ("source");--> statement-breakpoint
CREATE INDEX "regulations_jurisdiction_idx" ON "regulations" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "regulations_citation_idx" ON "regulations" USING btree ("citation");--> statement-breakpoint
CREATE INDEX "regulatory_requirements_regulation_id_idx" ON "regulatory_requirements" USING btree ("regulation_id");--> statement-breakpoint
CREATE INDEX "regulatory_requirements_jurisdiction_idx" ON "regulatory_requirements" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "regulatory_requirements_type_idx" ON "regulatory_requirements" USING btree ("requirement_type");--> statement-breakpoint
CREATE INDEX "state_overlays_state_idx" ON "state_overlays" USING btree ("state");--> statement-breakpoint
CREATE INDEX "state_overlays_type_idx" ON "state_overlays" USING btree ("overlay_type");--> statement-breakpoint
CREATE UNIQUE INDEX "waste_codes_code_key" ON "waste_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "waste_codes_series_idx" ON "waste_codes" USING btree ("series");--> statement-breakpoint
CREATE INDEX "waste_codes_is_acute_hazardous_idx" ON "waste_codes" USING btree ("is_acute_hazardous");--> statement-breakpoint
CREATE UNIQUE INDEX "waste_frameworks_key_key" ON "waste_frameworks" USING btree ("key");--> statement-breakpoint
CREATE INDEX "waste_stream_characteristics_stream_id_idx" ON "waste_stream_characteristics" USING btree ("waste_stream_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waste_streams_key_key" ON "waste_streams" USING btree ("key");--> statement-breakpoint
CREATE INDEX "waste_streams_framework_idx" ON "waste_streams" USING btree ("waste_framework");--> statement-breakpoint
CREATE INDEX "waste_streams_lane_idx" ON "waste_streams" USING btree ("lane_eligibility");--> statement-breakpoint
CREATE INDEX "waste_streams_active_idx" ON "waste_streams" USING btree ("active");
-- ============================================================================
-- updated_at triggers
-- ============================================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "waste_frameworks"             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "waste_codes"                  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "waste_streams"                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "waste_stream_characteristics" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "dot_hazmat_table"             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "placard_requirements"        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "label_requirements"          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "land_disposal_restrictions"  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "chemicals"                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "regulations"                  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "regulatory_requirements"      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "jurisdiction_matrix"          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "state_overlays"              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "conflict_resolutions"        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
