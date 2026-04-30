// POST /api/contact handler.
// Simpler than /api/booking — just name, email, retreat interest (free text),
// and a message. Writes to the Airtable Contacts table and fires two emails.

import type { Env } from './index';
import type { Lang } from './validate';
import { createContactRecord } from './airtable';
import { sendContactConfirmation, sendContactOwnerNotification } from './email';

const MAX_BODY_BYTES = 16 * 1024; // 16 KB
const MAX_NAME = 100;
const MAX_MESSAGE = 4000;
const MAX_RETREAT = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactInput {
  name: string;
  email: string;
  retreatInterest: string;
  message: string;
  lang: Lang;
}

export async function handleContact(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const ct = request.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    return jsonResp({ ok: false, error: 'expected_json' }, 415);
  }

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
    if (v.error === 'honeypot') {
      // Silently pretend success — don't give bots useful signal
      return jsonResp({ ok: true, contactId: 'CO-' + crypto.randomUUID().slice(0, 8) });
    }
    return jsonResp({ ok: false, error: v.error, field: v.field }, 400);
  }
  const input = v.value;

  const at = await createContactRecord(input, env);
  if (!at.ok) {
    console.error('[contact] airtable failed:', at.error);
    return jsonResp({ ok: false, error: 'storage_failed' }, 500);
  }
  const contactId = at.displayId || at.recordId!;

  ctx.waitUntil(
    (async () => {
      const [guest, owner] = await Promise.all([
        sendContactConfirmation(env, input, contactId),
        sendContactOwnerNotification(env, input, contactId),
      ]);
      if (!guest.ok) console.error('[contact] guest email failed:', guest.error);
      if (!owner.ok) console.error('[contact] owner email failed:', owner.error);
    })(),
  );

  return jsonResp({ ok: true, contactId });
}

// -- Validation ------------------------------------------------------------

type ValidateResult =
  | { ok: true; value: ContactInput }
  | { ok: false; error: string; field?: string };

function validate(body: unknown): ValidateResult {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'invalid_body' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.website === 'string' && b.website.trim() !== '') {
    return { ok: false, error: 'honeypot' };
  }

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length === 0 || name.length > MAX_NAME) {
    return { ok: false, error: 'invalid_name', field: 'name' };
  }

  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'invalid_email', field: 'email' };
  }

  const retreatInterest = typeof b.retreatInterest === 'string' ? b.retreatInterest.trim() : '';
  if (retreatInterest.length > MAX_RETREAT) {
    return { ok: false, error: 'invalid_retreat', field: 'retreatInterest' };
  }

  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (message.length > MAX_MESSAGE) {
    return { ok: false, error: 'message_too_long', field: 'message' };
  }

  const lang = b.lang === 'en' ? 'en' : 'de';

  return {
    ok: true,
    value: { name, email, retreatInterest, message, lang },
  };
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
