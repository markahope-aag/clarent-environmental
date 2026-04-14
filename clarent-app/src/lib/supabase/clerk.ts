import { auth } from '@clerk/nextjs/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client wired to Clerk's session token.
 *
 * Uses Supabase's native third-party auth integration with Clerk (enabled
 * in the Supabase dashboard → Authentication → Third-Party Auth). Clerk's
 * session JWT is passed as the Bearer token, Supabase verifies it against
 * Clerk's JWKS, and `auth.jwt()` inside RLS policies returns the Clerk
 * claims (`sub`, `org_id`, `org_role`, etc).
 *
 * Use this factory anywhere reads need to be gated by RLS per the current
 * generator/vendor/ops user. Writes that must bypass RLS continue to use
 * the Drizzle client via `@/lib/db/client` (which connects with
 * postgres-js on the transaction pooler and has full privileges).
 *
 * Each call returns a fresh client bound to the current request's auth
 * context — do not cache the returned client across requests.
 */
export async function createClerkSupabaseClient(): Promise<SupabaseClient> {
  const { getToken } = await auth();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // accessToken() is called by supabase-js on every request so the
      // JWT stays fresh if Clerk rotates it mid-session.
      accessToken: async () => (await getToken()) ?? null,
      auth: {
        // We're not using Supabase Auth — Clerk is the identity source.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
