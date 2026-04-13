import { clerkMiddleware } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

// Compose Clerk auth with Supabase session refresh. Clerk runs first to
// populate the request with auth context, then Supabase refreshes its own
// session cookies inside the same request cycle.
export default clerkMiddleware(async (_auth, request: NextRequest) => {
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
