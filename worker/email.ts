// Resend email client. Sends two messages per successful booking:
//   1. Guest confirmation (to input.email) — bilingual based on form lang
//   2. Owner notification (to env.MAIL_OWNER) — always German (owner reads DE)
//
// Docs: https://resend.com/docs/api-reference/emails/send-email
//
// Both sends are fire-and-forget via ctx.waitUntil so a slow email doesn't
// block the form response. If sending fails we log it; the booking row was
// already saved so the data isn't lost.

import type { BookingInput } from './validate';
import type { Env } from './index';

const RESEND_URL = 'https://api.resend.com/emails';

interface SendResult {
  ok: boolean;
  error?: string;
}

async function send(
  env: Env,
  payload: {
    from: string;
    to: string | string[];
    reply_to?: string;
    subject: string;
    html: string;
    text: string;
  },
): Promise<SendResult> {
  // If the Resend key hasn't been set yet, skip gracefully so the booking
  // still succeeds. Useful on first deploy before Resend is configured.
  if (!env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping send to', payload.to);
    return { ok: false, error: 'resend_api_key_not_set' };
  }
  try {
    const r = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return { ok: false, error: `resend ${r.status}: ${text.slice(0, 400)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `network: ${(e as Error).message}` };
  }
}

// -- Guest confirmation ----------------------------------------------------

export function sendGuestConfirmation(
  env: Env,
  input: BookingInput,
  bookingId: string,
): Promise<SendResult> {
  const subject =
    input.lang === 'de'
      ? 'Deine Buchungsanfrage bei Tree House Yoga'
      : 'Your booking request at Tree House Yoga';

  const greeting = input.lang === 'de' ? `Hallo ${input.name}` : `Hi ${input.name}`;

  const intro =
    input.lang === 'de'
      ? 'vielen Dank für deine Anfrage. Wir haben deine Buchungsanfrage erhalten und melden uns innerhalb von 48 Stunden persönlich bei dir mit den nächsten Schritten (Anzahlung, Ankunft, Fragen).'
      : 'thanks for reaching out. We received your booking request and will get back to you personally within 48 hours with the next steps (deposit, arrival, questions).';

  const labels =
    input.lang === 'de'
      ? { retreat: 'Retreat', dates: 'Daten', guests: 'Gäste', msg: 'Deine Nachricht' }
      : { retreat: 'Retreat', dates: 'Dates', guests: 'Guests', msg: 'Your message' };

  const signoff =
    input.lang === 'de'
      ? 'Bis bald unter den Palmen,\nTree House Yoga'
      : 'See you under the palms,\nTree House Yoga';

  const rowsText = [
    `${labels.retreat}: ${input.retreatTitle}`,
    input.dates ? `${labels.dates}: ${input.dates}` : null,
    `${labels.guests}: ${input.guests}`,
    input.message ? `${labels.msg}: ${input.message}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const text = `${greeting},\n\n${intro}\n\n${rowsText}\n\n[${bookingId}]\n\n${signoff}`;

  const html = layout({
    heading: greeting + ',',
    bodyHtml: `
      <p>${esc(intro)}</p>
      <table style="border-collapse:collapse;margin:16px 0">
        ${row(labels.retreat, input.retreatTitle)}
        ${input.dates ? row(labels.dates, input.dates) : ''}
        ${row(labels.guests, String(input.guests))}
        ${input.message ? row(labels.msg, input.message) : ''}
      </table>
      <p style="color:#999;font-size:12px">Referenz: ${esc(bookingId)}</p>
      <p style="white-space:pre-line">${esc(signoff)}</p>
    `,
  });

  return send(env, {
    from: env.MAIL_FROM,
    to: input.email,
    reply_to: env.MAIL_OWNER,
    subject,
    html,
    text,
  });
}

// -- Owner notification ----------------------------------------------------

export function sendOwnerNotification(
  env: Env,
  input: BookingInput,
  bookingId: string,
): Promise<SendResult> {
  const subject = `Neue Buchungsanfrage: ${input.name} — ${input.retreatTitle}`;

  const text = [
    `Neue Buchungsanfrage (${bookingId})`,
    '',
    `Name:    ${input.name}`,
    `Email:   ${input.email}`,
    `Retreat: ${input.retreatTitle} (${input.retreatCode})`,
    `Daten:   ${input.dates}`,
    `Gäste:   ${input.guests}`,
    `Sprache: ${input.lang}`,
    '',
    input.message ? `Nachricht:\n${input.message}` : '(keine Nachricht)',
  ].join('\n');

  const html = layout({
    heading: 'Neue Buchungsanfrage',
    bodyHtml: `
      <table style="border-collapse:collapse;margin:16px 0">
        ${row('Name', input.name)}
        ${row('Email', `<a href="mailto:${esc(input.email)}">${esc(input.email)}</a>`)}
        ${row('Retreat', `${esc(input.retreatTitle)} (${esc(input.retreatCode)})`)}
        ${row('Daten', input.dates)}
        ${row('Gäste', String(input.guests))}
        ${row('Sprache', input.lang)}
        ${input.message ? row('Nachricht', input.message) : ''}
      </table>
      <p style="color:#999;font-size:12px">ID: ${esc(bookingId)}</p>
    `,
  });

  return send(env, {
    from: env.MAIL_FROM,
    to: env.MAIL_OWNER,
    reply_to: input.email,
    subject,
    html,
    text,
  });
}

// -- Contact confirmation (to guest) --------------------------------------

import type { ContactInput } from './contact';

export function sendContactConfirmation(
  env: Env,
  input: ContactInput,
  contactId: string,
): Promise<SendResult> {
  const subject =
    input.lang === 'de'
      ? 'Deine Nachricht bei Tree House Yoga'
      : 'Your message to Tree House Yoga';

  const greeting = input.lang === 'de' ? `Hallo ${input.name}` : `Hi ${input.name}`;

  const intro =
    input.lang === 'de'
      ? 'vielen Dank für deine Nachricht. Wir haben sie erhalten und melden uns in der Regel am selben Werktag bei dir.'
      : 'thanks for your message. We received it and will usually get back to you the same working day.';

  const labels = input.lang === 'de'
    ? { retreat: 'Interesse an', msg: 'Deine Nachricht' }
    : { retreat: 'Interested in', msg: 'Your message' };

  const signoff =
    input.lang === 'de'
      ? 'Herzliche Grüße,\nTree House Yoga'
      : 'Warmly,\nTree House Yoga';

  const rowsText = [
    input.retreatInterest ? `${labels.retreat}: ${input.retreatInterest}` : null,
    input.message ? `${labels.msg}: ${input.message}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const text = `${greeting},\n\n${intro}\n\n${rowsText}\n\n[${contactId}]\n\n${signoff}`;

  const html = layout({
    heading: greeting + ',',
    bodyHtml: `
      <p>${esc(intro)}</p>
      <table style="border-collapse:collapse;margin:16px 0">
        ${input.retreatInterest ? row(labels.retreat, input.retreatInterest) : ''}
        ${input.message ? row(labels.msg, input.message) : ''}
      </table>
      <p style="color:#999;font-size:12px">Referenz: ${esc(contactId)}</p>
      <p style="white-space:pre-line">${esc(signoff)}</p>
    `,
  });

  return send(env, {
    from: env.MAIL_FROM,
    to: input.email,
    reply_to: env.MAIL_OWNER,
    subject,
    html,
    text,
  });
}

export function sendContactOwnerNotification(
  env: Env,
  input: ContactInput,
  contactId: string,
): Promise<SendResult> {
  const subject = `Neue Kontaktanfrage: ${input.name}`;

  const text = [
    `Neue Kontaktanfrage (${contactId})`,
    '',
    `Name:     ${input.name}`,
    `Email:    ${input.email}`,
    input.retreatInterest ? `Interesse: ${input.retreatInterest}` : null,
    `Sprache:  ${input.lang}`,
    '',
    input.message ? `Nachricht:\n${input.message}` : '(keine Nachricht)',
  ]
    .filter(Boolean)
    .join('\n');

  const html = layout({
    heading: 'Neue Kontaktanfrage',
    bodyHtml: `
      <table style="border-collapse:collapse;margin:16px 0">
        ${row('Name', input.name)}
        ${row('Email', `<a href="mailto:${esc(input.email)}">${esc(input.email)}</a>`)}
        ${input.retreatInterest ? row('Interesse', input.retreatInterest) : ''}
        ${row('Sprache', input.lang)}
        ${input.message ? row('Nachricht', input.message) : ''}
      </table>
      <p style="color:#999;font-size:12px">ID: ${esc(contactId)}</p>
    `,
  });

  return send(env, {
    from: env.MAIL_FROM,
    to: env.MAIL_OWNER,
    reply_to: input.email,
    subject,
    html,
    text,
  });
}

// -- Shared HTML bits ------------------------------------------------------

function layout(parts: { heading: string; bodyHtml: string }): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Tree House Yoga</title></head>
<body style="font-family:Georgia,serif;color:#2b2b2b;background:#faf7f2;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border:1px solid #e8e0d3">
    <h1 style="font-size:20px;margin:0 0 16px">${esc(parts.heading)}</h1>
    ${parts.bodyHtml}
  </div>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:4px 16px 4px 0;color:#7a7266;font-size:13px;vertical-align:top">${esc(label)}</td>
    <td style="padding:4px 0;font-size:14px">${value}</td>
  </tr>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
