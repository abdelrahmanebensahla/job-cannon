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

        // Two unique constraints exist on this table: id (PK) and email.
        // Handle both idempotently:
        //   - id conflict     = webhook redelivery for the same user
        //   - email conflict  = a stale row (e.g. dev-instance artifact)
        //                       is squatting on this email. We do NOT
        //                       silently delete that row, because in
        //                       long-running production it could be a
        //                       paying customer with subscriptions and
        //                       digest history that ON DELETE CASCADE
        //                       would wipe. Log a warning and ack the
        //                       webhook (so Clerk stops retrying); the
        //                       row needs manual reconciliation.
        try {
          await db
            .insert(users)
            .values({ id: data.id, email })
            // Upsert (not insert): a re-delivered user.created is idempotent and
            // also keeps email in sync. An email-unique collision with a
            // DIFFERENT row still throws 23505 and is handled below.
            .onConflictDoUpdate({ target: users.id, set: { email } });
        } catch (e) {
          if (e instanceof Error && /duplicate key|23505|unique/i.test(e.message)) {
            console.warn(
              `Clerk webhook: user.created for id=${data.id} blocked by an existing row with the same email (${email}). Manual reconciliation needed.`,
            );
            return NextResponse.json({
              ok: true,
              handled: 'user.created:email_conflict_skipped',
            });
          }
          throw e;
        }
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
