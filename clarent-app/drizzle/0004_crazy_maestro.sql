CREATE TYPE "public"."complexity_tier" AS ENUM('lane_1_standard', 'lane_2_simple', 'lane_2_complex');--> statement-breakpoint
CREATE TABLE "commodity_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waste_stream_key" text NOT NULL,
	"value_per_unit" numeric(12, 4) NOT NULL,
	"unit" text NOT NULL,
	"source" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lane1_price_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pricing_zone_id" uuid NOT NULL,
	"waste_stream_key" text NOT NULL,
	"container_type" text NOT NULL,
	"min_containers" integer DEFAULT 1 NOT NULL,
	"max_containers" integer,
	"unit_price" numeric(12, 2) NOT NULL,
	"stop_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"minimum_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
	"estimated_total" numeric(12, 2) NOT NULL,
	"confidence" numeric(5, 2),
	"source_vendor_ids" uuid[],
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markup_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"waste_framework" "waste_framework",
	"complexity_tier" "complexity_tier" NOT NULL,
	"markup_pct" numeric(6, 2) NOT NULL,
	"markup_floor_amount" numeric(12, 2),
	"markup_ceiling_amount" numeric(12, 2),
	"margin_floor_pct" numeric(5, 2) NOT NULL,
	"margin_ceiling_pct" numeric(5, 2),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"state" text,
	"zip_prefixes" text[],
	"center_lat" numeric(9, 6),
	"center_lng" numeric(9, 6),
	"radius_miles" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"pricing_zone_id" uuid,
	"waste_framework" "waste_framework" NOT NULL,
	"waste_stream_key" text,
	"container_type" text,
	"per_unit_price" numeric(12, 2) NOT NULL,
	"minimum_job_charge" numeric(12, 2),
	"stop_fee" numeric(12, 2),
	"fuel_surcharge_pct" numeric(5, 2),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lane1_price_cache" ADD CONSTRAINT "lane1_price_cache_pricing_zone_id_pricing_zones_id_fk" FOREIGN KEY ("pricing_zone_id") REFERENCES "public"."pricing_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_pricing" ADD CONSTRAINT "vendor_pricing_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_pricing" ADD CONSTRAINT "vendor_pricing_pricing_zone_id_pricing_zones_id_fk" FOREIGN KEY ("pricing_zone_id") REFERENCES "public"."pricing_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commodity_values_stream_idx" ON "commodity_values" USING btree ("waste_stream_key");--> statement-breakpoint
CREATE INDEX "commodity_values_effective_from_idx" ON "commodity_values" USING btree ("effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "lane1_cache_zone_stream_container_key" ON "lane1_price_cache" USING btree ("pricing_zone_id","waste_stream_key","container_type") WHERE "lane1_price_cache"."active" IS TRUE;--> statement-breakpoint
CREATE INDEX "lane1_cache_stream_idx" ON "lane1_price_cache" USING btree ("waste_stream_key");--> statement-breakpoint
CREATE INDEX "lane1_cache_expires_at_idx" ON "lane1_price_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "markup_policies_framework_idx" ON "markup_policies" USING btree ("waste_framework");--> statement-breakpoint
CREATE INDEX "markup_policies_tier_idx" ON "markup_policies" USING btree ("complexity_tier");--> statement-breakpoint
CREATE INDEX "markup_policies_active_idx" ON "markup_policies" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_zones_name_key" ON "pricing_zones" USING btree ("name");--> statement-breakpoint
CREATE INDEX "pricing_zones_state_idx" ON "pricing_zones" USING btree ("state");--> statement-breakpoint
CREATE INDEX "pricing_zones_active_idx" ON "pricing_zones" USING btree ("active");--> statement-breakpoint
CREATE INDEX "vendor_pricing_vendor_id_idx" ON "vendor_pricing" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_pricing_zone_id_idx" ON "vendor_pricing" USING btree ("pricing_zone_id");--> statement-breakpoint
CREATE INDEX "vendor_pricing_framework_idx" ON "vendor_pricing" USING btree ("waste_framework");--> statement-breakpoint
CREATE INDEX "vendor_pricing_stream_idx" ON "vendor_pricing" USING btree ("waste_stream_key");--> statement-breakpoint
CREATE INDEX "vendor_pricing_effective_from_idx" ON "vendor_pricing" USING btree ("effective_from");