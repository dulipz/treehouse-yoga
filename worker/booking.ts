// POST /api/booking handler.
//
// Flow:
//   1. Parse + validate body (reject malformed → 400)
//   2. Create Airtable row (hard-fail → 500 since we'd lose the lead)
//   3. Fire both emails via ctx.waitUntil (non-blocking)
//   4. Return {ok:true, bookingId} — the form shows a success screen
//
// Design decision: if Airtable succeeds but email fails, we still return
// success to the user — their booking is saved, we just log and fix later.
// If Airtable fails, we DO return an error so the user can retry.

import type { Env } from './index';
import { validate } from './validate';
import { createBookingRecord } from './airtable';
import { sendGuestConfirmation, sendOwnerNotification } from './email';

const MAX_BODY_BYTES = 16 * 1024; // 16 KB

export async function handleBooking(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  // Content-Type check — we only speak JSON
  const ct = request.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    return jsonResp({ ok: false, error: 'expected_json' }, 415);
  }

  // Read body (bounded) — if it's huge, reject
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return jsonResp({ ok: false, error: 'body_too_large' }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return jsonResp({ ok: false, error: 'invalid_json' }, 400);
  }

  const v = validate(parsed);
  if (!v.ok) {
    // Honeypot hit: pretend success so bots don't retry differently.
    if (v.error === 'honeypot') {
      return jsonResp({ ok: true, bookingId: 'BK-' + crypto.randomUUID().slice(0, 8) });
    }
    return jsonResp({ ok: false, error: v.error, field: v.field }, 400);
  }
  const input = v.value;

  // Create the Airtable row
  const at = await createBookingRecord(input, env);
  if (!at.ok) {
    console.error('[booking] airtable failed:', at.error);
    return jsonResp({ ok: false, error: 'storage_failed' }, 500);
  }
  const bookingId = at.bookingId || at.recordId!;

  // Fire emails without blocking the response
  ctx.waitUntil(
    (async () => {
      const [guest, owner] = await Promise.all([
        sendGuestConfirmation(env, input, bookingId),
        sendOwnerNotification(env, input, bookingId),
      ]);
      if (!guest.ok) console.error('[booking] guest email failed:', guest.error);
      if (!owner.ok) console.error('[booking] owner email failed:', owner.error);
    })(),
  );

  return jsonResp({ ok: true, bookingId });
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
