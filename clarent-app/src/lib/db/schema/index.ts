// Clarent Drizzle schema — barrel file.
//
// All tables and enums are defined in group modules, this file just
// re-exports them so drizzle-kit + the Drizzle client see a single
// schema surface. Import from here:
//
//   import { generators, jobs, appUsers } from '@/lib/db/schema';

export * from './core';
export * from './operational';
export * from './financial';
export * from './compliance';
export * from './pricing';
export * from './infrastructure';
export * from './reference';
export * from './clerk-bridge';
