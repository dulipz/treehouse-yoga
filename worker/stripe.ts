// Stripe integration — runs inside Cloudflare Workers.
//
// We talk to the Stripe REST API directly (no SDK) because the official
// stripe-node package needs Node built-ins that aren't available in Workers.
//
// Two endpoints:
//   POST /api/checkout         → create a Checkout Session, return its URL
//   POST /api/stripe-webhook   → confirm payment, mark Airtable as paid
//
// Secrets (set with `wrangler secret put <NAME>`):
//   STRIPE_SECRET_KEY      sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET  whsec_...  (from Stripe dashboard webhook settings)
//
// Public vars (in wrangler.toml [vars]):
//   STRIPE_DEPOSIT_CENTS   default deposit in the smallest currency unit
//   STRIPE_CURRENCY        e.g. "eur"

import type { Env } from './index';

// ---------------------------------------------------------------------------
// POST /api/checkout
// Body: { bookingId: string, retreatTitle: string, email: string, lang: 'de'|'en' }
// Response: { ok: true, url: string } | { ok: false, error: string }
// ---------------------------------------------------------------------------

export async function handleCheckout(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResp({ ok: false, error: 'stripe_not_configured' }, 503);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResp({ ok: false, error: 'invalid_json' }, 400);
  }

  const bookingId = String(body.bookingId || '').slice(0, 64);
  const retreatTitle = String(body.retreatTitle || 'Yoga Retreat').slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const lang = body.lang === 'en' ? 'en' : 'de';

  if (!bookingId || !email) {
    return jsonResp({ ok: false, error: 'missing_fields' }, 400);
  }

  const amountCents = parseInt(env.STRIPE_DEPOSIT_CENTS || '10000', 10); // €100 default for test
  const currency = (env.STRIPE_CURRENCY || 'eur').toLowerCase();

  // Stripe's API takes form-encoded params (yes, even in 2026).
  // Bracket notation is how you express nested objects.
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${env.SITE_URL}/booking/success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${env.SITE_URL}/booking/cancelled.html`);
  params.set('customer_email', email);
  params.set('locale', lang === 'de' ? 'de' : 'en');
  params.set('client_reference_id', bookingId);
  params.set('metadata[bookingId]', bookingId);
  params.set('metadata[retreatTitle]', retreatTitle);

  // Payment methods — Stripe will fall back to whatever's enabled in the dashboard,
  // but we can scope to the ones we actually want.
  params.append('payment_method_types[]', 'card');
  params.append('payment_method_types[]', 'paypal');
  // SEPA is enabled separately in dashboard; uncomment once active in test mode:
  // params.append('payment_method_types[]', 'sepa_debit');

  // Single line item: the deposit
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', currency);
  params.set('line_items[0][price_data][unit_amount]', String(amountCents));
  params.set(
    'line_items[0][price_data][product_data][name]',
    lang === 'de'
      ? `Anzahlung — ${retreatTitle}`
      : `Deposit — ${retreatTitle}`,
  );
  params.set(
    'line_items[0][price_data][product_data][description]',
    lang === 'de'
      ? 'Verbindliche Anzahlung. Restbetrag fällig vor Beginn des Retreats.'
      : 'Booking deposit. Balance due before the retreat starts.',
  );

  let response: Response;
  try {
    response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Idempotency: same bookingId never creates two sessions.
        'Idempotency-Key': `checkout_${bookingId}`,
      },
      body: params.toString(),
    });
  } catch (e) {
    console.error('[stripe] network error:', e);
    return jsonResp({ ok: false, error: 'network' }, 502);
  }

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[stripe] session create failed:', response.status, data);
    return jsonResp({ ok: false, error: 'stripe_error', detail: data?.error?.message }, 502);
  }
  if (!data?.url) {
    return jsonResp({ ok: false, error: 'stripe_no_url' }, 502);
  }

  return jsonResp({ ok: true, url: data.url, sessionId: data.id });
}

// ---------------------------------------------------------------------------
// POST /api/stripe-webhook
// Stripe pushes events here. We verify the signature, then on
// checkout.session.completed we mark the matching Airtable booking as paid.
// ---------------------------------------------------------------------------

export async function handleStripeWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response('webhook not configured', { status: 503 });
  }

  const sig = request.headers.get('stripe-signature') || '';
  const raw = await request.text();

  const verified = await verifyStripeSignature(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!verified) {
    return new Response('bad signature', { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object || {};
    const bookingId =
      session.client_reference_id || session.metadata?.bookingId || null;
    const sessionId = session.id;
    const amountTotal = session.amount_total;
    const currency = session.currency;
    const paymentStatus = session.payment_status; // "paid"

    console.log('[stripe] payment confirmed', { bookingId, sessionId, amountTotal, currency, paymentStatus });

    // Update Airtable in the background — Stripe just needs a 200 fast.
    if (bookingId) {
      ctx.waitUntil(markBookingPaid(env, bookingId, sessionId, amountTotal, currency));
    }
  }

  return new Response('ok', { status: 200 });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Verify Stripe's signature header. Stripe signs `${t}.${payload}` with
// HMAC-SHA256 using your webhook secret. Header looks like:
//   t=1700000000,v1=abc123...,v0=...
async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  ) as Record<string, string>;
  const timestamp = parts.t;
  const signed = parts.v1;
  if (!timestamp || !signed) return false;

  // Reject events older than 5 minutes — replay attack defence.
  const ageSec = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (Number.isNaN(ageSec) || ageSec > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time compare
  if (expected.length !== signed.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signed.charCodeAt(i);
  }
  return diff === 0;
}

// Find the booking by its display ID and patch the payment fields.
// Requires three fields on the Bookings table:
//   "Payment status" (single-select: unpaid, deposit_paid)
//   "Stripe session" (text)
//   "Deposit paid" (currency or number, optional)
async function markBookingPaid(
  env: Env,
  bookingId: string,
  sessionId: string,
  amountTotal: number | null,
  currency: string | null,
): Promise<void> {
  try {
    const findUrl =
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}` +
      `?filterByFormula=${encodeURIComponent(`{Booking ID}='${bookingId}'`)}&maxRecords=1`;
    const findRes = await fetch(findUrl, {
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` },
    });
    if (!findRes.ok) {
      console.error('[stripe] airtable lookup failed', findRes.status);
      return;
    }
    const findBody: any = await findRes.json();
    const recordId = findBody?.records?.[0]?.id;
    if (!recordId) {
      console.error('[stripe] booking not found:', bookingId);
      return;
    }

    const fields: Record<string, unknown> = {
      'Payment status': 'deposit_paid',
      'Stripe session': sessionId,
    };
    if (typeof amountTotal === 'number') {
      fields['Deposit paid'] = amountTotal / 100;
    }

    const patchUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME)}/${recordId}`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields, typecast: true }),
    });
    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => '');
      console.error('[stripe] airtable patch failed:', patchRes.status, t.slice(0, 300));
    }
  } catch (e) {
    console.error('[stripe] markBookingPaid error:', e);
  }
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
