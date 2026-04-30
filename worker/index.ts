// Cloudflare Worker entry point.
//
// Routes:
//   POST /api/booking  → handleBooking (writes to Airtable + sends emails)
//   OPTIONS /api/booking → CORS preflight OK
//   anything else      → fall through to the static site served from ./dist
//
// Secrets (set via `wrangler secret put <NAME>`):
//   AIRTABLE_TOKEN    — Airtable personal access token
//   RESEND_API_KEY    — Resend API key
//
// Public vars (in wrangler.toml [vars]):
//   AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME, MAIL_FROM, MAIL_OWNER, SITE_URL

import { handleBooking } from './booking';
import { handleContact } from './contact';
import { handleCheckout, handleStripeWebhook } from './stripe';

export interface Env {
  // Static-assets binding (serves ./dist)
  ASSETS: Fetcher;

  // Public vars
  AIRTABLE_BASE_ID: string;
  AIRTABLE_TABLE_NAME: string;      // Bookings table
  AIRTABLE_CONTACTS_TABLE: string;  // Contacts table
  MAIL_FROM: string;
  MAIL_OWNER: string;
  SITE_URL: string;
  STRIPE_DEPOSIT_CENTS?: string;    // smallest currency unit, e.g. "10000" = €100.00
  STRIPE_CURRENCY?: string;         // e.g. "eur"

  // Secrets
  AIRTABLE_TOKEN: string;
  RESEND_API_KEY: string;
  STRIPE_SECRET_KEY?: string;       // sk_test_... or sk_live_...
  STRIPE_WEBHOOK_SECRET?: string;   // whsec_...
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // API routes
    if (
      url.pathname === '/api/booking' ||
      url.pathname === '/api/contact' ||
      url.pathname === '/api/checkout' ||
      url.pathname === '/api/stripe-webhook'
    ) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': env.SITE_URL,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
            'Access-Control-Max-Age': '86400',
          },
        });
      }
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'method_not_allowed' }, 405);
      }
      if (url.pathname === '/api/booking') return handleBooking(request, env, ctx);
      if (url.pathname === '/api/contact') return handleContact(request, env, ctx);
      if (url.pathname === '/api/checkout') return handleCheckout(request, env);
      if (url.pathname === '/api/stripe-webhook') return handleStripeWebhook(request, env, ctx);
    }

    // Everything else: static site
    return env.ASSETS.fetch(request);
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
