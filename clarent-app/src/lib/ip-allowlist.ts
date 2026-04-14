/**
 * Tiny IPv4 CIDR allowlist.
 *
 * Config via the `OPS_IP_ALLOWLIST` env var — comma-separated list of
 * single IPs or CIDR ranges. Empty value disables the gate (useful in
 * local dev). IPv6 is not supported yet; if your office is IPv6-only you
 * can add its prefix here later.
 *
 * Example:
 *   OPS_IP_ALLOWLIST="203.0.113.5,203.0.113.64/28,10.0.0.0/8"
 */

const ipv4ToLong = (ip: string): number | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let total = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    total = total * 256 + n;
  }
  return total >>> 0;
};

const matchesCidr = (ip: string, cidr: string): boolean => {
  const ipLong = ipv4ToLong(ip);
  if (ipLong === null) return false;

  if (!cidr.includes('/')) {
    const target = ipv4ToLong(cidr);
    return target !== null && target === ipLong;
  }

  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const rangeLong = ipv4ToLong(range);
  if (rangeLong === null) return false;

  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipLong & mask) === (rangeLong & mask);
};

export const parseAllowlist = (value: string | undefined | null): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

/**
 * Returns true if the given IP is in the allowlist, or if the allowlist is
 * empty (which disables the gate).
 */
export const isAllowedIp = (ip: string | null, allowlist: readonly string[]): boolean => {
  if (allowlist.length === 0) return true;
  if (!ip) return false;
  return allowlist.some((entry) => matchesCidr(ip, entry));
};

/**
 * Extract the originating client IP from common request headers set by
 * Vercel's edge / Cloudflare / standard reverse proxies.
 */
export const extractClientIp = (headers: Headers): string | null => {
  // Cloudflare proxy (only meaningful when orange-cloud; currently grey)
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf.trim();

  // Vercel + most CDNs
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  const real = headers.get('x-real-ip');
  if (real) return real.trim();

  return null;
};
