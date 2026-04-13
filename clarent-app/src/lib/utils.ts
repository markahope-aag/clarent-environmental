/**
 * Shared utility functions.
 */

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const assertDefined = <T>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`${label} is required`);
  }
  return value;
};
