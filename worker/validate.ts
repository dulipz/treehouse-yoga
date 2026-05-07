// Input validation for the booking form.
//
// This is a public endpoint, so we reject anything malformed before touching
// Airtable or Resend. Validation is deliberately strict: unknown keys are
// allowed (ignored), but known keys must match their shape exactly.

export type Lang = 'de' | 'en';
/** Retreat slug — short kebab-case identifier from the Retreats Airtable table. */
export type RetreatCode = string;

export interface BookingInput {
  name: string;
  email: string;
  retreatCode: RetreatCode;
  retreatTitle: string;
  dates: string;
  guests: number;
  /** Room slug (optional for now — modal validates client-side too). */
  room?: string;
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

// Slugs are kebab-case lowercase, optional digits and hyphens.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

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

  const retreatCodeRaw = typeof b.retreatCode === 'string' ? b.retreatCode.trim().toLowerCase() : '';
  if (!SLUG_RE.test(retreatCodeRaw)) {
    return { ok: false, error: 'invalid_retreat', field: 'retreatCode' };
  }
  const retreatCode = retreatCodeRaw;

  // Room is optional — older clients (or group-inquiry bookings) may omit it.
  // When present, must match slug shape.
  let room: string | undefined;
  if (b.room !== undefined && b.room !== null && b.room !== '') {
    const roomRaw = typeof b.room === 'string' ? b.room.trim().toLowerCase() : '';
    if (!SLUG_RE.test(roomRaw)) {
      return { ok: false, error: 'invalid_room', field: 'room' };
    }
    room = roomRaw;
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
      room,
      message,
      lang,
    },
  };
}
