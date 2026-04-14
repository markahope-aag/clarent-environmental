-- ============================================================================
-- Granular RLS policies — role-aware access for generators, vendors, ops
-- ============================================================================
--
-- Supabase's Clerk third-party auth integration issues the `authenticated`
-- role to verified Clerk JWTs. auth.jwt() inside policies returns the
-- Clerk claims (sub = user ID, org_id = active org, org_role = membership
-- role). Helper functions below resolve those claims to Clarent entity IDs.
--
-- Principle: reads are gated by RLS; writes go through server actions
-- using Drizzle (which bypasses RLS via the postgres role). Ops console
-- uses Drizzle for both reads and writes, bypassing everything.

-- ============================================================================
-- Helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_clerk_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() ->> 'sub')::text
$$;

CREATE OR REPLACE FUNCTION public.current_clerk_org_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() ->> 'org_id')::text
$$;

-- Resolve current Clerk org → Clarent generator_id. SECURITY DEFINER so
-- the function bypasses RLS on app_organizations (no recursion).
CREATE OR REPLACE FUNCTION public.current_generator_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ao.generator_id
  FROM public.app_organizations ao
  WHERE ao.clerk_organization_id = (auth.jwt() ->> 'org_id')::text
    AND ao.organization_type = 'generator'
    AND ao.deleted_at IS NULL
    AND ao.generator_id IS NOT NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_vendor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ao.vendor_id
  FROM public.app_organizations ao
  WHERE ao.clerk_organization_id = (auth.jwt() ->> 'org_id')::text
    AND ao.organization_type = 'vendor'
    AND ao.deleted_at IS NULL
    AND ao.vendor_id IS NOT NULL
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_clerk_user_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_clerk_org_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_generator_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_vendor_id() TO authenticated;

-- ============================================================================
-- Core entities
-- ============================================================================

CREATE POLICY "generators_self_read" ON public.generators
  FOR SELECT TO authenticated
  USING (id = public.current_generator_id());

CREATE POLICY "generator_locations_self_read" ON public.generator_locations
  FOR SELECT TO authenticated
  USING (generator_id = public.current_generator_id());

CREATE POLICY "generator_contacts_self_read" ON public.generator_contacts
  FOR SELECT TO authenticated
  USING (generator_id = public.current_generator_id());

CREATE POLICY "vendors_self_read" ON public.vendors
  FOR SELECT TO authenticated
  USING (id = public.current_vendor_id());

CREATE POLICY "vendor_capabilities_self_read" ON public.vendor_capabilities
  FOR SELECT TO authenticated
  USING (vendor_id = public.current_vendor_id());

CREATE POLICY "vendor_service_areas_self_read" ON public.vendor_service_areas
  FOR SELECT TO authenticated
  USING (vendor_id = public.current_vendor_id());

-- ============================================================================
-- Operational
-- ============================================================================

CREATE POLICY "jobs_generator_read" ON public.jobs
  FOR SELECT TO authenticated
  USING (generator_id = public.current_generator_id());

-- Vendors see jobs only after they've been notified / awarded
CREATE POLICY "jobs_vendor_read_post_award" ON public.jobs
  FOR SELECT TO authenticated
  USING (
    selected_vendor_id = public.current_vendor_id()
    AND state IN (
      'vendor_notified',
      'pickup_scheduled',
      'balance_due',
      'balance_paid',
      'pickup_completed',
      'documents_processing',
      'completed'
    )
  );

CREATE POLICY "job_waste_streams_read" ON public.job_waste_streams
  FOR SELECT TO authenticated
  USING (job_id IN (SELECT id FROM public.jobs));

CREATE POLICY "certifications_generator_read" ON public.certifications
  FOR SELECT TO authenticated
  USING (generator_id = public.current_generator_id());

-- RFQs: vendor sees ones they were invited to
CREATE POLICY "rfqs_vendor_invited_read" ON public.rfqs
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT rfq_id FROM public.rfq_recipients
      WHERE vendor_id = public.current_vendor_id()
    )
  );

-- RFQs: generator sees ones for their own jobs
CREATE POLICY "rfqs_generator_own_job_read" ON public.rfqs
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs
      WHERE generator_id = public.current_generator_id()
    )
  );

CREATE POLICY "rfq_recipients_vendor_self_read" ON public.rfq_recipients
  FOR SELECT TO authenticated
  USING (vendor_id = public.current_vendor_id());

CREATE POLICY "vendor_quotes_self_read" ON public.vendor_quotes
  FOR SELECT TO authenticated
  USING (vendor_id = public.current_vendor_id());

CREATE POLICY "quotes_generator_read" ON public.quotes
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs
      WHERE generator_id = public.current_generator_id()
    )
  );

-- ============================================================================
-- Financial
-- ============================================================================

CREATE POLICY "invoices_generator_read" ON public.invoices
  FOR SELECT TO authenticated
  USING (generator_id = public.current_generator_id());

CREATE POLICY "invoices_vendor_read" ON public.invoices
  FOR SELECT TO authenticated
  USING (vendor_id = public.current_vendor_id());

CREATE POLICY "invoice_line_items_read" ON public.invoice_line_items
  FOR SELECT TO authenticated
  USING (invoice_id IN (SELECT id FROM public.invoices));

CREATE POLICY "payments_generator_read" ON public.payments
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs
      WHERE generator_id = public.current_generator_id()
    )
  );

CREATE POLICY "payouts_vendor_self_read" ON public.payouts
  FOR SELECT TO authenticated
  USING (vendor_id = public.current_vendor_id());

-- ============================================================================
-- Compliance
-- ============================================================================

CREATE POLICY "compliance_obligations_generator_read" ON public.compliance_obligations
  FOR SELECT TO authenticated
  USING (generator_id = public.current_generator_id());

CREATE POLICY "compliance_calendar_generator_read" ON public.compliance_calendar_entries
  FOR SELECT TO authenticated
  USING (generator_id = public.current_generator_id());

CREATE POLICY "non_compliant_generator_read" ON public.non_compliant_waste_events
  FOR SELECT TO authenticated
  USING (generator_id = public.current_generator_id());

CREATE POLICY "non_compliant_vendor_read" ON public.non_compliant_waste_events
  FOR SELECT TO authenticated
  USING (reporting_vendor_id = public.current_vendor_id());

CREATE POLICY "manifests_generator_read" ON public.manifests
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs
      WHERE generator_id = public.current_generator_id()
    )
  );

CREATE POLICY "manifests_vendor_read" ON public.manifests
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs
      WHERE selected_vendor_id = public.current_vendor_id()
    )
  );

-- ============================================================================
-- Pricing
-- ============================================================================

CREATE POLICY "pricing_zones_auth_read" ON public.pricing_zones
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "vendor_pricing_self_read" ON public.vendor_pricing
  FOR SELECT TO authenticated
  USING (vendor_id = public.current_vendor_id());

-- markup_policies: no authenticated policy (service_role only)

CREATE POLICY "lane1_cache_auth_read" ON public.lane1_price_cache
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "commodity_values_auth_read" ON public.commodity_values
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- Infrastructure
-- ============================================================================

-- audit_log: service_role only (no policy)
-- incidents: service_role only (no policy)

CREATE POLICY "comm_log_generator_read" ON public.communication_log
  FOR SELECT TO authenticated
  USING (related_generator_id = public.current_generator_id());

CREATE POLICY "comm_log_vendor_read" ON public.communication_log
  FOR SELECT TO authenticated
  USING (related_vendor_id = public.current_vendor_id());

CREATE POLICY "documents_generator_read" ON public.documents
  FOR SELECT TO authenticated
  USING (
    access_policy IN ('generator_visible', 'public')
    AND (
      (related_type = 'generator' AND related_id = public.current_generator_id())
      OR (related_type = 'generator_location' AND related_id IN (
        SELECT id FROM public.generator_locations
        WHERE generator_id = public.current_generator_id()
      ))
      OR (related_type IN ('job','certification','invoice','manifest') AND related_id IN (
        SELECT id FROM public.jobs
        WHERE generator_id = public.current_generator_id()
      ))
    )
  );

CREATE POLICY "documents_vendor_read" ON public.documents
  FOR SELECT TO authenticated
  USING (
    access_policy IN ('vendor_visible', 'public')
    AND (
      (related_type = 'vendor' AND related_id = public.current_vendor_id())
      OR (related_type IN ('rfq','vendor_quote','job','invoice') AND related_id IN (
        SELECT id FROM public.jobs
        WHERE selected_vendor_id = public.current_vendor_id()
      ))
    )
  );

-- ============================================================================
-- Reference data — broad read for authenticated users, some for anon too
-- ============================================================================

CREATE POLICY "waste_frameworks_auth_read" ON public.waste_frameworks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "waste_codes_auth_read" ON public.waste_codes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "waste_streams_auth_read" ON public.waste_streams
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "waste_stream_characteristics_auth_read" ON public.waste_stream_characteristics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dot_hazmat_auth_read" ON public.dot_hazmat_table
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "placard_requirements_auth_read" ON public.placard_requirements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "label_requirements_auth_read" ON public.label_requirements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ldr_auth_read" ON public.land_disposal_restrictions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "chemicals_auth_read" ON public.chemicals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "regulations_auth_read" ON public.regulations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "regulatory_requirements_auth_read" ON public.regulatory_requirements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "jurisdiction_matrix_auth_read" ON public.jurisdiction_matrix
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "state_overlays_auth_read" ON public.state_overlays
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "conflict_resolutions_auth_read" ON public.conflict_resolutions
  FOR SELECT TO authenticated USING (true);

-- Anon gets waste streams + lane1 cache for the public quote estimator
CREATE POLICY "waste_streams_anon_read" ON public.waste_streams
  FOR SELECT TO anon USING (active = true);

CREATE POLICY "lane1_cache_anon_read" ON public.lane1_price_cache
  FOR SELECT TO anon USING (active = true);

-- ============================================================================
-- Clerk bridge
-- ============================================================================

CREATE POLICY "app_users_self_read" ON public.app_users
  FOR SELECT TO authenticated
  USING (clerk_user_id = public.current_clerk_user_id());

CREATE POLICY "app_organizations_self_read" ON public.app_organizations
  FOR SELECT TO authenticated
  USING (clerk_organization_id = public.current_clerk_org_id());

CREATE POLICY "app_memberships_self_read" ON public.app_memberships
  FOR SELECT TO authenticated
  USING (clerk_user_id = public.current_clerk_user_id());
