import { describe, expect, it } from 'vitest';
import { extractClientIp, isAllowedIp, parseAllowlist } from './ip-allowlist';

describe('parseAllowlist', () => {
  it('returns empty array for unset env var', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist(null)).toEqual([]);
    expect(parseAllowlist('')).toEqual([]);
  });

  it('parses comma-separated entries and trims whitespace', () => {
    expect(parseAllowlist('1.2.3.4, 5.6.7.8/24 ,9.0.0.0/8')).toEqual([
      '1.2.3.4',
      '5.6.7.8/24',
      '9.0.0.0/8',
    ]);
  });
});

describe('isAllowedIp', () => {
  it('allows any IP when the list is empty (gate disabled)', () => {
    expect(isAllowedIp('203.0.113.5', [])).toBe(true);
    expect(isAllowedIp(null, [])).toBe(true);
  });

  it('denies null IP when list is non-empty', () => {
    expect(isAllowedIp(null, ['203.0.113.5'])).toBe(false);
  });

  it('matches exact single IP entries', () => {
    expect(isAllowedIp('203.0.113.5', ['203.0.113.5'])).toBe(true);
    expect(isAllowedIp('203.0.113.6', ['203.0.113.5'])).toBe(false);
  });

  it('matches CIDR /24 ranges', () => {
    const list = ['203.0.113.0/24'];
    expect(isAllowedIp('203.0.113.0', list)).toBe(true);
    expect(isAllowedIp('203.0.113.255', list)).toBe(true);
    expect(isAllowedIp('203.0.112.1', list)).toBe(false);
    expect(isAllowedIp('203.0.114.1', list)).toBe(false);
  });

  it('matches CIDR /28 ranges', () => {
    const list = ['203.0.113.64/28']; // 64-79
    expect(isAllowedIp('203.0.113.64', list)).toBe(true);
    expect(isAllowedIp('203.0.113.79', list)).toBe(true);
    expect(isAllowedIp('203.0.113.80', list)).toBe(false);
    expect(isAllowedIp('203.0.113.63', list)).toBe(false);
  });

  it('matches /8 ranges spanning the class A boundary', () => {
    const list = ['10.0.0.0/8'];
    expect(isAllowedIp('10.0.0.1', list)).toBe(true);
    expect(isAllowedIp('10.255.255.254', list)).toBe(true);
    expect(isAllowedIp('11.0.0.1', list)).toBe(false);
  });

  it('matches /0 (catch-all)', () => {
    expect(isAllowedIp('1.2.3.4', ['0.0.0.0/0'])).toBe(true);
  });

  it('rejects malformed IPs', () => {
    expect(isAllowedIp('not-an-ip', ['203.0.113.5'])).toBe(false);
    expect(isAllowedIp('203.0.113', ['203.0.113.5'])).toBe(false);
    expect(isAllowedIp('203.0.113.256', ['203.0.113.0/24'])).toBe(false);
  });

  it('accepts first match when multiple entries are present', () => {
    const list = ['198.51.100.0/24', '203.0.113.5'];
    expect(isAllowedIp('203.0.113.5', list)).toBe(true);
    expect(isAllowedIp('198.51.100.42', list)).toBe(true);
    expect(isAllowedIp('8.8.8.8', list)).toBe(false);
  });
});

describe('extractClientIp', () => {
  it('prefers cf-connecting-ip when present', () => {
    const h = new Headers({
      'cf-connecting-ip': '203.0.113.5',
      'x-forwarded-for': '198.51.100.1',
    });
    expect(extractClientIp(h)).toBe('203.0.113.5');
  });

  it('falls back to first value in x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1, 10.0.0.2' });
    expect(extractClientIp(h)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when others are missing', () => {
    const h = new Headers({ 'x-real-ip': '203.0.113.5' });
    expect(extractClientIp(h)).toBe('203.0.113.5');
  });

  it('returns null when no identifying header present', () => {
    expect(extractClientIp(new Headers())).toBeNull();
  });
});
