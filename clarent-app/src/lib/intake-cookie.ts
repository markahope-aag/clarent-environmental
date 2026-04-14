import { cookies } from 'next/headers';

/**
 * Short-lived cookie that carries intake data through the anonymous
 * sign-up redirect flow. Contains only what the user just typed in — no
 * authentication or billing state. Base64-encoded JSON so it's readable
 * from the server component in /generator/finalize.
 */

export type PendingIntake = {
  businessName: string;
  industry: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  contactPhone: string;
  wasteStreamKey: string;
  containerType: string;
  containerCount: number;
  notes: string;
  createdAt: number;
};

const COOKIE_NAME = 'clarent_pending_intake';
const MAX_AGE_SECONDS = 60 * 30; // 30 minutes to complete Clerk signup

export async function setPendingIntakeCookie(data: PendingIntake): Promise<void> {
  const store = await cookies();
  const encoded = Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
  store.set(COOKIE_NAME, encoded, {
    maxAge: MAX_AGE_SECONDS,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function readPendingIntakeCookie(): Promise<PendingIntake | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as PendingIntake;
  } catch {
    return null;
  }
}

export async function clearPendingIntakeCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
