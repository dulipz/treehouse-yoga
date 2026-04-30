// Input validation for the booking form.
//
// This is a public endpoint, so we reject anything malformed before touching
// Airtable or Resend. Validation is deliberately strict: unknown keys are
// allowed (ignored), but known keys must match their shape exactly.

export type Lang = 'de' | 'en';
export type RetreatCode = 'r1' | 'r2';

export interface BookingInput {
  name: string;
  email: string;
  retreatCode: RetreatCode;
  retreatTitle: string;
  dates: string;
  guests: number;
  message: string;
  lang: Lang;
  // Honeypot — must be empty. Bots fill it in, humans never see it.
  website?: string;
}

export type ValidateResult =
  | { ok: true; value: BookingInput }
  | { ok: false; error: string; field?: string };

// Basic RFC-5322-ish check. Not perfect but good enough — the real validation
// is "can we deliver to it", which only sending the email proves.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_NAME = 100;
const MAX_MESSAGE = 2000;
const MAX_DATES = 120;
const MAX_TITLE = 200;
const MAX_GUESTS = 8;

export function validate(body: unknown): ValidateResult {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'invalid_body' };
  }
  const b = body as Record<string, unknown>;

  // Honeypot — if a bot filled this, silently reject.
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

  const retreatCode = b.retreatCode;
  if (retreatCode !== 'r1' && retreatCode !== 'r2') {
    return { ok: false, error: 'invalid_retreat', field: 'retreatCode' };
  }

  const retreatTitle = typeof b.retreatTitle === 'string' ? b.retreatTitle.trim() : '';
  if (retreatTitle.length > MAX_TITLE) {
    return { ok: false, error: 'invalid_title', field: 'retreatTitle' };
  }

  const dates = typeof b.dates === 'string' ? b.dates.trim() : '';
  if (dates.length > MAX_DATES) {
    return { ok: false, error: 'invalid_dates', field: 'dates' };
  }

  const guestsRaw = typeof b.guests === 'number' ? b.guests : Number(b.guests);
  const guests = Number.isFinite(guestsRaw) ? Math.floor(guestsRaw) : 0;
  if (guests < 1 || guests > MAX_GUESTS) {
    return { ok: false, error: 'invalid_guests', field: 'guests' };
  }

  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (message.length > MAX_MESSAGE) {
    return { ok: false, error: 'message_too_long', field: 'message' };
  }

  const lang = b.lang === 'en' ? 'en' : 'de'; // default de

  return {
    ok: true,
    value: {
      name,
      email,
      retreatCode,
      retreatTitle,
      dates,
      guests,
      message,
      lang,
    },
  };
}
