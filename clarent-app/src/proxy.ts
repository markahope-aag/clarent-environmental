import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { detectPortal, PORTAL_PREFIXES, type Portal } from '@/lib/portal';
import { updateSession } from '@/utils/supabase/middleware';

// Paths that should never be rewritten (API routes, Next internals, webhooks).
function isPassThroughPath(path: string): boolean {
  return path.startsWith('/api') || path.startsWith('/_next') || path.startsWith('/trpc');
}

/**
 * Compose Clerk auth with subdomain portal routing and Supabase session
 * refresh. Order of operations per request:
 *
 *   1. Clerk populates auth context.
 *   2. Detect incoming subdomain → portal.
 *   3. If the path tries to access a portal subtree from the wrong host,
 *      return 404.
 *   4. If the host is a portal subdomain and the request is not a pass-
 *      through path, rewrite to the portal's subtree.
 *   5. Refresh the Supabase session and return the final response.
 */
export default clerkMiddleware(async (_auth, request: NextRequest) => {
  const host = request.headers.get('host');
  const portal = detectPortal(host);
  const path = request.nextUrl.pathname;

  // Block direct access to any portal subtree from a host that doesn't match.
  // e.g. clarentenvironmental.com/vendor/dashboard → 404
  for (const [key, prefix] of Object.entries(PORTAL_PREFIXES) as [Portal, string][]) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      if (portal !== key) {
        return new NextResponse('Not found', { status: 404 });
      }
    }
  }

  // Rewrite portal subdomain requests into the portal's subtree.
  if (portal && !isPassThroughPath(path)) {
    const prefix = PORTAL_PREFIXES[portal];
    if (!path.startsWith(prefix)) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = path === '/' ? prefix : `${prefix}${path}`;
      return await updateSession(request, rewriteUrl);
    }
  }

  return await updateSession(request);
});

export const config = {
  matcher: [
    // Clerk-recommended matcher: skip Next.js internals and static files,
    // always run on api/trpc routes.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
