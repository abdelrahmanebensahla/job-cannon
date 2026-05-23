import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';

export const runtime = 'nodejs';

type ClerkEmail = { id: string; email_address: string };

type ClerkUserCreated = {
  type: 'user.created';
  data: {
    id: string;
    primary_email_address_id: string | null;
    email_addresses: ClerkEmail[];
  };
};

type ClerkUserDeleted = {
  type: 'user.deleted';
  data: { id: string; deleted: boolean };
};

type ClerkEvent = ClerkUserCreated | ClerkUserDeleted | { type: string; data: unknown };

type WebhookResponse = { ok: true; handled: string } | { ok: false; error: string };

function fail(error: string, status = 400): NextResponse<WebhookResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

function primaryEmail(evt: ClerkUserCreated['data']): string | null {
  const primary = evt.email_addresses.find(e => e.id === evt.primary_email_address_id);
  return primary?.email_address ?? evt.email_addresses[0]?.email_address ?? null;
}

export async function POST(request: Request): Promise<NextResponse<WebhookResponse>> {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error('CLERK_WEBHOOK_SECRET is not set');
    return fail('webhook_not_configured', 500);
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return fail('missing_svix_headers');
  }

  const body = await request.text();

  let evt: ClerkEvent;
  try {
    evt = new Webhook(secret).verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent;
  } catch (e) {
    console.warn('Clerk webhook signature verification failed:', e instanceof Error ? e.message : e);
    return fail('invalid_signature', 401);
  }

  try {
    switch (evt.type) {
      case 'user.created': {
        const data = (evt as ClerkUserCreated).data;
        const email = primaryEmail(data);
        if (!email) return fail('no_email_on_user');
        await db
          .insert(users)
          .values({ id: data.id, email })
          .onConflictDoNothing({ target: users.id });
        return NextResponse.json({ ok: true, handled: 'user.created' });
      }
      case 'user.deleted': {
        const data = (evt as ClerkUserDeleted).data;
        await db.delete(users).where(eq(users.id, data.id));
        return NextResponse.json({ ok: true, handled: 'user.deleted' });
      }
      default:
        // We don't subscribe to other events. Acknowledge so Clerk doesn't retry.
        return NextResponse.json({ ok: true, handled: `ignored:${evt.type}` });
    }
  } catch (e) {
    console.error('Clerk webhook handler error:', e);
    return fail('handler_failed', 500);
  }
}
