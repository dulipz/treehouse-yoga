// Single source of truth for all retreats.
//
// Data is fetched from Airtable at build time. Editing happens in Airtable;
// the site is rebuilt to pick up changes (`npm run deploy`).
//
// Required env (in .env.local at repo root, or as a build-time env var):
//   AIRTABLE_TOKEN=pat...
//
// Tables used (base ID is hard-coded below):
//   • Retreats           — one row per retreat
//   • Retreat Itinerary  — one row per day, linked to Retreat
//
// Inclusions and exclusions stay in this file because they're identical
// across both retreats. Move them to Airtable later if they ever diverge.

import fs from 'node:fs/promises';
import path from 'node:path';

export interface Bilingual {
  de: string;
  en: string;
}

export interface ItineraryDay {
  /** short day label, e.g. 'Sa' / 'Sat' */
  day: Bilingual;
  title: Bilingual;
  body: Bilingual;
}

export interface Retreat {
  /** URL slug — used at /retreats/<slug>.html */
  slug: string;
  /** Stable short identifier used by the booking modal (r1, r2, …) */
  code: string;
  /** 'live' = visible everywhere · 'hidden' = exists but not listed · 'draft' = build-only */
  status: 'live' | 'hidden' | 'draft';
  /** Show on the homepage "featured" grid */
  featured: boolean;
  /** Sort order on listing pages (smaller first) */
  order: number;
  /** Short name, e.g. "Dschungel & Meer" */
  title: Bilingual;
  /** Eyebrow prefix, e.g. "das Retreat Dschungel & Meer" */
  prefix: Bilingual;
  /** One-line tagline used on cards and as the detail hero H1 */
  subtitle: Bilingual;
  /** Display string for the retreat dates */
  dates: Bilingual;
  /** Availability badge on cards, e.g. "Noch 3 Plätze frei" */
  spots: Bilingual;
  /** Group size (integer) */
  guests: number;
  /** Displayed price, e.g. "€2,400" */
  price: string;
  /** Deposit amount, e.g. "€400" */
  deposit: string;
  /** When the remaining balance is due */
  remainingDue: Bilingual;
  /** Card image (hero on /retreats and the homepage featured grid) */
  cardImage: string;
  /** Detail page hero background */
  heroImage: string;
  /** Opening paragraph on the detail page */
  lede: Bilingual;
  /** Day-by-day schedule */
  itinerary: ItineraryDay[];
  /** What's included */
  inclusions: Bilingual[];
  /** What's not included */
  exclusions: Bilingual[];
  /** Retreat start date as ISO YYYY-MM-DD, or null. Used by the month filter. */
  startDate: string | null;
  /** Tag slugs for the type/focus filter, e.g. ['beginner','silent'] */
  tags: string[];
  /** True when the retreat has no spots left. Drives the availability filter. */
  soldOut: boolean;
}

// ---- Shared content (not yet in Airtable) -------------------------------

const sharedInclusions: Bilingual[] = [
  { de: 'Sieben Nächte in einer geteilten Villa-Suite', en: 'Seven nights in a shared villa suite' },
  { de: 'Zwei Yoga-Einheiten täglich', en: 'Two daily yoga sessions' },
  { de: 'Pranayama- & Meditations-Workshops', en: 'Pranayama & meditation workshops' },
  { de: 'Alle Mahlzeiten, srilankisch & vegetarisch', en: 'All meals, Sri Lankan & vegetarian' },
  { de: 'Flughafentransfer (CMB)', en: 'Airport transfer (CMB)' },
  { de: 'Ein Tagesausflug (Galle & Riff)', en: 'One day trip (Galle & reef)' },
];

const sharedExclusions: Bilingual[] = [
  { de: 'Flüge nach Sri Lanka', en: 'Flights to Sri Lanka' },
  { de: 'Reiseversicherung', en: 'Travel insurance' },
  { de: 'Visum (ETA, unkompliziert online)', en: 'Visa (ETA, straightforward online)' },
  { de: 'Alkoholische Getränke', en: 'Alcoholic drinks' },
  { de: 'Einzelzimmer-Aufpreis', en: 'Private room upgrade' },
];

// ---- Airtable fetch ------------------------------------------------------

const BASE_ID = 'appIFPQ3y33OFocaO';
const RETREATS_TABLE = 'Retreats';
const ITINERARY_TABLE = 'Retreat Itinerary';

// Module-level cache so multiple pages reusing this module hit Airtable once.
let cache: Promise<Retreat[]> | null = null;

interface AirtableAttachment {
  id: string;
  url: string;
  filename?: string;
  type?: string;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function airtableList(table: string, token: string): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams();
    qs.set('pageSize', '100');
    if (offset) qs.set('offset', offset);
    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}?${qs}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable list ${table} → ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

// ---- Image caching -------------------------------------------------------
//
// Airtable returns signed attachment URLs that expire. For a static build we
// download each attachment once into public/assets/cms/, keyed by the
// attachment's stable ID. The build then serves the local copy.
//
// File naming: <slug>-<kind>-<attachmentId>.<ext>
//   When the user uploads a new image, the attachmentId changes, so a new
//   file is written. Stale files become orphans (harmless; ignore or sweep).

const PUBLIC_CMS_DIR = path.resolve(process.cwd(), 'public', 'assets', 'cms');

function extFromAttachment(att: AirtableAttachment): string {
  if (att.filename) {
    const m = att.filename.match(/\.([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
  }
  if (att.type) {
    const m = att.type.match(/\/([a-z0-9+]+)$/i);
    if (m) return m[1].toLowerCase().replace('jpeg', 'jpg');
  }
  return 'jpg';
}

async function ensureLocalImage(
  att: AirtableAttachment | undefined,
  slug: string,
  kind: 'card' | 'hero',
  fallback: string,
): Promise<string> {
  if (!att?.url) return fallback;
  const ext = extFromAttachment(att);
  const filename = `${slug}-${kind}-${att.id}.${ext}`;
  const publicPath = `/assets/cms/${filename}`;
  const fsPath = path.join(PUBLIC_CMS_DIR, filename);

  // If we already have a non-empty file at this path, we're done.
  try {
    const stat = await fs.stat(fsPath);
    if (stat.size > 0) return publicPath;
  } catch {
    // not present — fall through to download
  }

  await fs.mkdir(PUBLIC_CMS_DIR, { recursive: true });
  const res = await fetch(att.url);
  if (!res.ok) {
    console.warn(`[retreats] image download failed (${res.status}) for ${slug}/${kind}; falling back`);
    return fallback;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(fsPath, buf);
  return publicPath;
}

// ---- Mapping -------------------------------------------------------------

function statusFromAirtable(v: unknown): 'live' | 'hidden' | 'draft' {
  if (v === 'visible') return 'live';
  if (v === 'hidden') return 'hidden';
  if (v === 'draft') return 'draft';
  // Anything else (including undefined) → hidden, so a half-set-up row never
  // accidentally goes live.
  return 'hidden';
}

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function bilingual(de: unknown, en: unknown): Bilingual {
  return { de: s(de), en: s(en) };
}

async function loadFromAirtable(): Promise<Retreat[]> {
  const token = (import.meta.env.AIRTABLE_TOKEN as string | undefined)
    ?? process.env.AIRTABLE_TOKEN;
  if (!token) {
    throw new Error(
      '[retreats] AIRTABLE_TOKEN is not set. Add it to .env.local at the repo root, '
      + 'or export it before running `npm run build`.',
    );
  }

  const [retreatRecords, itineraryRecords] = await Promise.all([
    airtableList(RETREATS_TABLE, token),
    airtableList(ITINERARY_TABLE, token),
  ]);

  // Group itinerary by parent retreat ID, sorted by Day Number.
  const itineraryByRetreat = new Map<string, ItineraryDay[]>();
  const sortedItinerary = [...itineraryRecords].sort((a, b) => {
    const an = (a.fields['Day Number'] as number) ?? 999;
    const bn = (b.fields['Day Number'] as number) ?? 999;
    return an - bn;
  });
  for (const rec of sortedItinerary) {
    const parents = (rec.fields.Retreat as string[] | undefined) ?? [];
    for (const parentId of parents) {
      let bucket = itineraryByRetreat.get(parentId);
      if (!bucket) {
        bucket = [];
        itineraryByRetreat.set(parentId, bucket);
      }
      bucket.push({
        day: bilingual(rec.fields['Day Label DE'], rec.fields['Day Label EN']),
        title: bilingual(rec.fields['Title DE'], rec.fields['Title EN']),
        body: bilingual(rec.fields['Body DE'], rec.fields['Body EN']),
      });
    }
  }

  // Sort retreats by OrderNumber (smaller first).
  const sorted = [...retreatRecords].sort((a, b) => {
    const an = (a.fields.OrderNumber as number) ?? 999;
    const bn = (b.fields.OrderNumber as number) ?? 999;
    return an - bn;
  });

  const out: Retreat[] = [];
  for (const rec of sorted) {
    const f = rec.fields;
    const slug = s(f.Slug);
    if (!slug) continue;
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      throw new Error(
        `[retreats] Invalid Slug "${slug}" in Airtable. Slugs must be `
        + `lowercase letters, numbers, and hyphens only — no spaces, `
        + `no uppercase, no special characters. Example: "jungle-and-ocean". `
        + `Open the Retreats table in Airtable and fix the Slug cell.`,
      );
    }

    const cardAtt = (f['Card Image'] as AirtableAttachment[] | undefined)?.[0];
    const heroAtt = (f['Hero Image'] as AirtableAttachment[] | undefined)?.[0];

    const cardImage = await ensureLocalImage(cardAtt, slug, 'card', '/assets/retreat-group-5.jpg');
    const heroImage = await ensureLocalImage(heroAtt, slug, 'hero', '/assets/hero-main.png');

    out.push({
      slug,
      code: s(f.Code),
      status: statusFromAirtable(f.Status),
      featured: !!f.Featured,
      order: (f.OrderNumber as number) ?? 999,
      title: bilingual(f['Title DE'], f['Title EN']),
      prefix: bilingual(f['Prefix DE'], f['Prefix EN']),
      subtitle: bilingual(f['Subtitle DE'], f['Subtitle EN']),
      dates: bilingual(f['Dates DE'], f['Dates EN']),
      spots: bilingual(f['Spots Label DE'], f['Spots Label EN']),
      guests: (f.Guests as number) ?? 0,
      // Price/Deposit are stored bilingually in Airtable but the site only
      // displays one. Prefer DE; fall back to EN if the DE cell is empty.
      price: s(f['Price DE']) || s(f['Price EN']),
      deposit: s(f['Deposit DE']) || s(f['Deposit EN']),
      remainingDue: bilingual(f['Remaining DE'], f['Remaining EN']),
      cardImage,
      heroImage,
      lede: bilingual(f['Lede DE'], f['Lede EN']),
      itinerary: itineraryByRetreat.get(rec.id) ?? [],
      inclusions: sharedInclusions,
      exclusions: sharedExclusions,
      startDate: typeof f['Start Date'] === 'string'
        ? (f['Start Date'] as string).slice(0, 10)
        : null,
      tags: Array.isArray(f.Tags) ? (f.Tags as string[]) : [],
      soldOut: !!f['Sold Out'],
    });
  }

  return out;
}

/** All retreats, sorted by `order`, including hidden/draft. */
export async function getRetreats(): Promise<Retreat[]> {
  if (!cache) cache = loadFromAirtable();
  return cache;
}

/** Retreats that should be visible in listings. */
export async function getVisibleRetreats(): Promise<Retreat[]> {
  return (await getRetreats()).filter((r) => r.status === 'live');
}

/** Retreats marked as featured for the homepage. */
export async function getFeaturedRetreats(): Promise<Retreat[]> {
  return (await getVisibleRetreats()).filter((r) => r.featured);
}

/** Lookup by slug. Returns undefined if no match. */
export async function getRetreat(slug: string): Promise<Retreat | undefined> {
  return (await getRetreats()).find((r) => r.slug === slug);
}
