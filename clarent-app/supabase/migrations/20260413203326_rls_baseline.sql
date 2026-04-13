-- ============================================================================
-- RLS baseline — enable row-level security on every table in public
-- ============================================================================
--
-- Default posture: DENY ALL for anon and authenticated roles. The Supabase
-- service_role bypasses RLS, so server-side code using
-- SUPABASE_SERVICE_ROLE_KEY continues to work for all operations.
--
-- Granular per-role policies (generator sees own jobs, vendor sees awarded
-- jobs, ops sees everything) will be added in subsequent migrations once
-- Clerk auth is wired and request-level JWT claims are available.
--
-- Reference / read-only tables (waste_codes, dot_hazmat_table, etc.) will
-- get public read policies separately — they are meant to be queryable by
-- any authenticated user.

-- Core entities
ALTER TABLE "generators"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generator_locations"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generator_contacts"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendors"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendor_capabilities"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendor_service_areas" ENABLE ROW LEVEL SECURITY;

-- Operational
ALTER TABLE "jobs"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_waste_streams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "certifications"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rfqs"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rfq_recipients"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendor_quotes"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotes"            ENABLE ROW LEVEL SECURITY;

-- Financial
ALTER TABLE "invoices"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_line_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payouts"            ENABLE ROW LEVEL SECURITY;

-- Compliance
ALTER TABLE "compliance_obligations"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compliance_calendar_entries"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "non_compliant_waste_events"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "manifests"                    ENABLE ROW LEVEL SECURITY;

-- Pricing
ALTER TABLE "pricing_zones"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendor_pricing"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "markup_policies"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lane1_price_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commodity_values"  ENABLE ROW LEVEL SECURITY;

-- Infrastructure
ALTER TABLE "audit_log"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidents"         ENABLE ROW LEVEL SECURITY;

-- Reference data
ALTER TABLE "waste_frameworks"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waste_codes"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waste_streams"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waste_stream_characteristics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dot_hazmat_table"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "placard_requirements"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "label_requirements"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "land_disposal_restrictions"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chemicals"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "regulations"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "regulatory_requirements"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jurisdiction_matrix"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "state_overlays"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conflict_resolutions"         ENABLE ROW LEVEL SECURITY;
