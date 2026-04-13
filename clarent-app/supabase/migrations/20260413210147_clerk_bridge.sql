CREATE TYPE "public"."organization_type" AS ENUM('generator', 'vendor', 'ops');--> statement-breakpoint
CREATE TABLE "app_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"clerk_organization_id" text NOT NULL,
	"role" text NOT NULL,
	"permissions" text[],
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_organization_id" text NOT NULL,
	"organization_type" "organization_type" NOT NULL,
	"generator_id" uuid,
	"vendor_id" uuid,
	"name" text NOT NULL,
	"slug" text,
	"image_url" text,
	"clerk_created_at" timestamp with time zone,
	"clerk_updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text,
	"first_name" text,
	"last_name" text,
	"image_url" text,
	"clerk_created_at" timestamp with time zone,
	"clerk_updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generators" ADD COLUMN "clerk_organization_id" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "clerk_organization_id" text;--> statement-breakpoint
ALTER TABLE "app_organizations" ADD CONSTRAINT "app_organizations_generator_id_generators_id_fk" FOREIGN KEY ("generator_id") REFERENCES "public"."generators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_organizations" ADD CONSTRAINT "app_organizations_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_memberships_user_org_key" ON "app_memberships" USING btree ("clerk_user_id","clerk_organization_id");--> statement-breakpoint
CREATE INDEX "app_memberships_user_idx" ON "app_memberships" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "app_memberships_org_idx" ON "app_memberships" USING btree ("clerk_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_organizations_clerk_organization_id_key" ON "app_organizations" USING btree ("clerk_organization_id");--> statement-breakpoint
CREATE INDEX "app_organizations_type_idx" ON "app_organizations" USING btree ("organization_type");--> statement-breakpoint
CREATE INDEX "app_organizations_generator_id_idx" ON "app_organizations" USING btree ("generator_id");--> statement-breakpoint
CREATE INDEX "app_organizations_vendor_id_idx" ON "app_organizations" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_clerk_user_id_key" ON "app_users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "app_users_email_idx" ON "app_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "generators_clerk_organization_id_key" ON "generators" USING btree ("clerk_organization_id") WHERE "generators"."clerk_organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_clerk_organization_id_key" ON "vendors" USING btree ("clerk_organization_id") WHERE "vendors"."clerk_organization_id" IS NOT NULL;
-- ============================================================================
-- updated_at triggers
-- ============================================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "app_users"         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "app_organizations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "app_memberships"   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Enable RLS on the new tables (deny-all baseline; service_role bypasses)
-- ============================================================================

ALTER TABLE "app_users"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_memberships"   ENABLE ROW LEVEL SECURITY;
