import { describe, expect, it } from 'vitest';
import { assertDefined, isNonEmptyString } from './utils';

describe('isNonEmptyString', () => {
  it('returns true for a non-empty string', () => {
    expect(isNonEmptyString('hello')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isNonEmptyString('')).toBe(false);
  });

  it('returns false for non-string values', () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString({})).toBe(false);
  });
});

describe('assertDefined', () => {
  it('returns the value when defined', () => {
    expect(assertDefined('foo', 'label')).toBe('foo');
    expect(assertDefined(0, 'label')).toBe(0);
    expect(assertDefined(false, 'label')).toBe(false);
  });

  it('throws when the value is null', () => {
    expect(() => assertDefined(null, 'thing')).toThrow('thing is required');
  });

  it('throws when the value is undefined', () => {
    expect(() => assertDefined(undefined, 'thing')).toThrow('thing is required');
  });
});
