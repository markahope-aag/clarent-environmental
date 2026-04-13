CREATE TYPE "public"."invoice_state" AS ENUM('draft', 'issued', 'partial', 'paid', 'overdue', 'disputed', 'void');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('ar_deposit', 'ar_balance', 'ar_non_compliant', 'ap_vendor');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'ach', 'wire', 'check', 'credit_applied', 'refund');--> statement-breakpoint
CREATE TYPE "public"."payment_state" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."payout_state" AS ENUM('pending', 'scheduled', 'in_transit', 'paid', 'failed', 'held', 'cancelled');--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"metadata" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_type" "invoice_type" NOT NULL,
	"job_id" uuid NOT NULL,
	"generator_id" uuid,
	"vendor_id" uuid,
	"state" "invoice_state" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"fees" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance_due" numeric(12, 2) NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"stripe_invoice_id" text,
	"stripe_payment_link_url" text,
	"external_document_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"state" "payment_state" DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"failure_reason" text,
	"processed_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"refund_amount" numeric(12, 2),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"invoice_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"state" "payout_state" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"stripe_transfer_id" text,
	"hold_reason" text,
	"failure_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_generator_id_generators_id_fk" FOREIGN KEY ("generator_id") REFERENCES "public"."generators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_job_id_idx" ON "invoices" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "invoices_generator_id_idx" ON "invoices" USING btree ("generator_id");--> statement-breakpoint
CREATE INDEX "invoices_vendor_id_idx" ON "invoices" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "invoices_state_idx" ON "invoices" USING btree ("state");--> statement-breakpoint
CREATE INDEX "invoices_invoice_type_idx" ON "invoices" USING btree ("invoice_type");--> statement-breakpoint
CREATE INDEX "invoices_due_at_idx" ON "invoices" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_job_id_idx" ON "payments" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "payments_state_idx" ON "payments" USING btree ("state");--> statement-breakpoint
CREATE INDEX "payments_stripe_payment_intent_id_idx" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "payouts_vendor_id_idx" ON "payouts" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "payouts_job_id_idx" ON "payouts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "payouts_invoice_id_idx" ON "payouts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payouts_state_idx" ON "payouts" USING btree ("state");--> statement-breakpoint
CREATE INDEX "payouts_scheduled_at_idx" ON "payouts" USING btree ("scheduled_at");
-- ============================================================================
-- updated_at triggers (set_updated_at() function already exists)
-- ============================================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "invoices"           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "invoice_line_items" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "payments"           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "payouts"            FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Type integrity: AR invoices have a generator, AP invoices have a vendor
-- ============================================================================

ALTER TABLE "invoices" ADD CONSTRAINT invoices_type_counterparty_chk CHECK (
  (invoice_type IN ('ar_deposit', 'ar_balance', 'ar_non_compliant') AND generator_id IS NOT NULL AND vendor_id IS NULL)
  OR
  (invoice_type = 'ap_vendor' AND vendor_id IS NOT NULL AND generator_id IS NULL)
);
