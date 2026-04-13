/**
 * Subdomain → portal resolution.
 *
 * Each portal lives under a path prefix in the app directory. At request
 * time the proxy middleware detects the incoming host and internally rewrites
 * the request to the portal's subtree so users see clean paths like
 * `/dashboard` while Next.js actually serves `/generator/dashboard`.
 *
 * Portal prefixes must match the app directory layout:
 *   src/app/generator/ → generator portal   (app.clarentenvironmental.com)
 *   src/app/vendor/    → vendor portal      (vendors.clarentenvironmental.com)
 *   src/app/ops/       → ops console        (ops.clarentenvironmental.com)
 */

export type Portal = 'generator' | 'vendor' | 'ops';

export const PORTAL_PREFIXES: Record<Portal, string> = {
  generator: '/generator',
  vendor: '/vendor',
  ops: '/ops',
};

const SUBDOMAIN_MAP: Record<string, Portal> = {
  app: 'generator',
  vendors: 'vendor',
  ops: 'ops',
};

/**
 * Resolve a portal from an incoming Host header.
 * Returns null for the bare domain or any unknown subdomain.
 */
export function detectPortal(host: string | null): Portal | null {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();

  // Production: app.clarentenvironmental.com, vendors.*, ops.*
  // Also matches local dev overrides like app.clarent.local
  const parts = hostname.split('.');
  if (parts.length < 2) return null;

  const subdomain = parts[0];
  return SUBDOMAIN_MAP[subdomain] ?? null;
}
