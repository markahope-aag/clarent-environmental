import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { db } from '@/lib/db/client';
import {
  appMemberships,
  appOrganizations,
  appUsers,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Clerk → Clarent identity sync webhook.
//
// Handles user.*, organization.*, and organizationMembership.* events. We
// keep a local cache of Clerk state so Postgres-side joins and RLS policies
// can resolve Clerk IDs → Clarent entities without round-tripping Clerk.
//
// Svix-signed. The signing secret is set in CLERK_WEBHOOK_SIGNING_SECRET.

type ClerkEvent = {
  type: string;
  data: Record<string, unknown>;
};

const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

const toDate = (value: unknown): Date | null => {
  if (typeof value !== 'number') return null;
  return new Date(value);
};

const primaryEmail = (data: Record<string, unknown>): string | null => {
  const emails = data.email_addresses;
  const primaryId = data.primary_email_address_id;
  if (!Array.isArray(emails)) return null;
  const primary = emails.find(
    (e): e is { id: string; email_address: string } =>
      typeof e === 'object' && e !== null && (e as { id?: unknown }).id === primaryId,
  );
  return primary?.email_address ?? null;
};

async function handleUserUpsert(data: Record<string, unknown>, deleted = false) {
  const clerkUserId = data.id as string;
  if (!clerkUserId) return;

  if (deleted) {
    await db
      .update(appUsers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(appUsers.clerkUserId, clerkUserId));
    return;
  }

  const values = {
    clerkUserId,
    email: primaryEmail(data),
    firstName: (data.first_name as string | null) ?? null,
    lastName: (data.last_name as string | null) ?? null,
    imageUrl: (data.image_url as string | null) ?? null,
    clerkCreatedAt: toDate(data.created_at),
    clerkUpdatedAt: toDate(data.updated_at),
    deletedAt: null,
  };

  await db
    .insert(appUsers)
    .values(values)
    .onConflictDoUpdate({
      target: appUsers.clerkUserId,
      set: { ...values, updatedAt: new Date() },
    });
}

async function handleOrganizationUpsert(data: Record<string, unknown>, deleted = false) {
  const clerkOrganizationId = data.id as string;
  if (!clerkOrganizationId) return;

  if (deleted) {
    await db
      .update(appOrganizations)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(appOrganizations.clerkOrganizationId, clerkOrganizationId));
    return;
  }

  // Default to 'generator' until onboarding metadata tells us otherwise.
  // Clerk's public_metadata.organization_type is the authoritative source.
  const meta = (data.public_metadata as Record<string, unknown> | undefined) ?? {};
  const orgType =
    meta.organization_type === 'vendor'
      ? 'vendor'
      : meta.organization_type === 'ops'
      ? 'ops'
      : 'generator';

  const values = {
    clerkOrganizationId,
    organizationType: orgType as 'generator' | 'vendor' | 'ops',
    name: (data.name as string) ?? 'Unnamed organization',
    slug: (data.slug as string | null) ?? null,
    imageUrl: (data.image_url as string | null) ?? null,
    clerkCreatedAt: toDate(data.created_at),
    clerkUpdatedAt: toDate(data.updated_at),
    deletedAt: null,
  };

  await db
    .insert(appOrganizations)
    .values(values)
    .onConflictDoUpdate({
      target: appOrganizations.clerkOrganizationId,
      set: { ...values, updatedAt: new Date() },
    });
}

async function handleMembershipUpsert(data: Record<string, unknown>, deleted = false) {
  const organization = data.organization as Record<string, unknown> | undefined;
  const publicUserData = data.public_user_data as Record<string, unknown> | undefined;
  const clerkUserId = publicUserData?.user_id as string | undefined;
  const clerkOrganizationId = organization?.id as string | undefined;
  const role = (data.role as string | undefined) ?? 'org:member';

  if (!clerkUserId || !clerkOrganizationId) return;

  if (deleted) {
    await db
      .update(appMemberships)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(appMemberships.clerkUserId, clerkUserId),
          eq(appMemberships.clerkOrganizationId, clerkOrganizationId),
        ),
      );
    return;
  }

  const values = {
    clerkUserId,
    clerkOrganizationId,
    role,
    deletedAt: null,
  };

  await db
    .insert(appMemberships)
    .values(values)
    .onConflictDoUpdate({
      target: [appMemberships.clerkUserId, appMemberships.clerkOrganizationId],
      set: { ...values, updatedAt: new Date() },
    });
}

export async function POST(req: Request) {
  if (!signingSecret) {
    console.error('CLERK_WEBHOOK_SIGNING_SECRET not set');
    return new NextResponse('server misconfigured', { status: 500 });
  }

  const hdrs = await headers();
  const svixId = hdrs.get('svix-id');
  const svixTimestamp = hdrs.get('svix-timestamp');
  const svixSignature = hdrs.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse('missing svix headers', { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(signingSecret);

  let event: ClerkEvent;
  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent;
  } catch (err) {
    console.error('svix verification failed:', err);
    return new NextResponse('invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        await handleUserUpsert(event.data);
        break;
      case 'user.deleted':
        await handleUserUpsert(event.data, true);
        break;
      case 'organization.created':
      case 'organization.updated':
        await handleOrganizationUpsert(event.data);
        break;
      case 'organization.deleted':
        await handleOrganizationUpsert(event.data, true);
        break;
      case 'organizationMembership.created':
      case 'organizationMembership.updated':
        await handleMembershipUpsert(event.data);
        break;
      case 'organizationMembership.deleted':
        await handleMembershipUpsert(event.data, true);
        break;
      default:
        // Unhandled event type — return 200 so Clerk doesn't retry.
        break;
    }
  } catch (err) {
    console.error(`error handling ${event.type}:`, err);
    return new NextResponse('handler error', { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
