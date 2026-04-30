#!/usr/bin/env node
// One-shot migration: seed Airtable Retreats + Retreat Itinerary tables from
// the current hard-coded data in src/data/retreats.ts.
//
// Usage:
//   AIRTABLE_TOKEN=pat... node scripts/migrate-retreats.mjs
//
// Or with a .env.local file at the repo root containing AIRTABLE_TOKEN=pat...
//
// Safe to re-run: the script first scans existing rows by slug and skips any
// retreat that already exists. If you want a clean re-seed, clear both tables
// in Airtable first.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---- Load token ----------------------------------------------------------
function loadEnvLocal() {
  const envPath = resolve(repoRoot, '.env.local');
  if (!existsSync(envPath)) return;
  const txt = readFileSync(envPath, 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (!(k in process.env)) {
      process.env[k] = v.replace(/^['"]|['"]$/g, '');
    }
  }
}
loadEnvLocal();

const TOKEN = process.env.AIRTABLE_TOKEN;
if (!TOKEN) {
  console.error('Missing AIRTABLE_TOKEN. Either export it or put it in .env.local');
  process.exit(1);
}

const BASE_ID = 'appIFPQ3y33OFocaO';
const RETREATS_TABLE = 'Retreats';
const ITINERARY_TABLE = 'Retreat Itinerary';
const SITE_URL = process.env.SITE_URL || 'https://treehouse-yoga.dulipz.workers.dev';

// ---- Data (mirrors src/data/retreats.ts) ---------------------------------
const sharedItinerary = [
  { dayNum: 1, dayDe: 'Sa', dayEn: 'Sat',
    titleDe: 'Ankunft', titleEn: 'Arrival',
    bodyDe: 'Abholung am Flughafen Colombo, Fahrt in den Süden, Abendessen auf der Veranda.',
    bodyEn: 'Colombo airport pickup, transfer south, dinner on the verandah.' },
  { dayNum: 2, dayDe: 'So', dayEn: 'Sun',
    titleDe: 'Ankommen', titleEn: 'Settling',
    bodyDe: 'Sanftes Morgen-Yoga, Nachmittag am Strand, ruhiger Abend.',
    bodyEn: 'Gentle morning yoga, afternoon at the beach, restorative evening.' },
  { dayNum: 3, dayDe: 'Mo', dayEn: 'Mon',
    titleDe: 'Rhythmus finden', titleEn: 'Finding rhythm',
    bodyDe: 'Zwei Praxen, Spaziergang an der Lagune vorbei, Reis und Curry.',
    bodyEn: 'Two practices, local walk past the lagoon, rice and curry.' },
  { dayNum: 4, dayDe: 'Di', dayEn: 'Tue',
    titleDe: 'Tiefer', titleEn: 'Deeper',
    bodyDe: 'Pranayama-Workshop, Nachmittag frei, Meditation zum Sonnenuntergang.',
    bodyEn: 'Pranayama workshop, afternoon free, sunset meditation.' },
  { dayNum: 5, dayDe: 'Mi', dayEn: 'Wed',
    titleDe: 'Stiller Tag', titleEn: 'Quiet day',
    bodyDe: 'Stiller Morgen bis Mittag. Lange Praxis. Optional: Schnorcheln am Riff.',
    bodyEn: 'Silent morning until noon. Long practice. Optional snorkel at the reef.' },
  { dayNum: 6, dayDe: 'Do', dayEn: 'Thu',
    titleDe: 'Unterwegs', titleEn: 'Open air',
    bodyDe: 'Tagesausflug nach Galle Fort und zur Schildkröten-Station.',
    bodyEn: 'Day trip to Galle fort and the turtle sanctuary.' },
  { dayNum: 7, dayDe: 'Fr', dayEn: 'Fri',
    titleDe: 'Zusammen', titleEn: 'Integration',
    bodyDe: 'Zwei Praxen, Abschlusszeremonie, gemeinsames Abendessen.',
    bodyEn: 'Two practices, closing ceremony, shared dinner.' },
  { dayNum: 8, dayDe: 'Sa', dayEn: 'Sat',
    titleDe: 'Abreise', titleEn: 'Departure',
    bodyDe: 'Frühstück, Fahrt nach Colombo.',
    bodyEn: 'Breakfast, transfer to Colombo.' },
];

const retreats = [
  {
    slug: 'jungle-and-ocean',
    code: 'r1',
    status: 'live',
    featured: true,
    order: 1,
    titleDe: 'Dschungel & Meer', titleEn: 'Jungle & Ocean',
    prefixDe: 'das Retreat Dschungel & Meer', prefixEn: 'the Jungle & Ocean retreat',
    subtitleDe: 'Sieben Nächte zwischen traumhaftem Strand und ruhigem Fluss.',
    subtitleEn: 'Seven nights between a dream beach and a quiet river.',
    datesDe: '14.–21. Nov. 2026', datesEn: '14–21 Nov 2026',
    spotsDe: 'Noch 3 Plätze frei', spotsEn: '3 spots left',
    guests: 8,
    price: '€2,400',
    deposit: '€400',
    remainingDueDe: '60 Tage vorher', remainingDueEn: 'at 60 days',
    cardImage: '/assets/retreat-group-5.jpg',
    heroImage: '/assets/hero-main.png',
    ledeDe: 'Eine erste, sanfte Woche für alle, die noch nie auf einem Retreat waren — und eine ruhige für alle, die schon einmal dabei waren. Ihr kommt an, ihr schlaft, und dann, langsam, beginnt die Woche.',
    ledeEn: 'A first, gentle week for those who have not been on retreat before — and a steadying one for those who have. You arrive, you sleep, and then, slowly, the week begins.',
  },
  {
    slug: 'quiet-mornings',
    code: 'r2',
    status: 'live',
    featured: true,
    order: 2,
    titleDe: 'Stille Morgen', titleEn: 'Quiet Mornings',
    prefixDe: 'das Retreat Stille Morgen', prefixEn: 'the Quiet Mornings retreat',
    subtitleDe: 'Zehn Nächte, tiefere Praxis, kleinere Gruppe.',
    subtitleEn: 'Ten nights, deeper practice, smaller group.',
    datesDe: '6.–16. Feb. 2027', datesEn: '6–16 Feb 2027',
    spotsDe: 'Frühbucher offen', spotsEn: 'Early booking open',
    guests: 6,
    price: '€3,100',
    deposit: '€400',
    remainingDueDe: '60 Tage vorher', remainingDueEn: 'at 60 days',
    cardImage: '/assets/retreat-group-15.jpg',
    heroImage: '/assets/hero-main.png',
    ledeDe: 'Ein längeres, stilleres Programm für wiederkehrende Gäste. Längere Morgen-Asana, eine Woche Stille von Mittwoch bis Freitag, und Raum, damit die Woche sich setzen kann.',
    ledeEn: 'A longer, quieter programme for returning guests. Longer morning asana, a week of silence from Wednesday to Friday, and space to let the week settle.',
  },
];

// status values: 'live' in code → 'visible' in Airtable
const statusMap = { live: 'visible', hidden: 'hidden', draft: 'draft' };

// ---- Airtable helpers ----------------------------------------------------
const apiBase = `https://api.airtable.com/v0/${BASE_ID}`;

async function airtable(path, init = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Airtable ${res.status} on ${path}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function listAllRecords(table) {
  const out = [];
  let offset;
  do {
    const qs = new URLSearchParams();
    qs.set('pageSize', '100');
    if (offset) qs.set('offset', offset);
    const data = await airtable(`/${encodeURIComponent(table)}?${qs}`);
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

async function createRecords(table, records) {
  // Airtable caps at 10 per call
  const created = [];
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const data = await airtable(`/${encodeURIComponent(table)}`, {
      method: 'POST',
      body: JSON.stringify({ records: chunk, typecast: true }),
    });
    created.push(...data.records);
  }
  return created;
}

// ---- Build field payloads ------------------------------------------------
function attachment(publicPath) {
  return [{ url: `${SITE_URL}${publicPath}` }];
}

function retreatFields(r) {
  return {
    Slug: r.slug,
    Code: r.code,
    Status: statusMap[r.status] || r.status,
    Featured: r.featured,
    OrderNumber: r.order,
    'Title DE': r.titleDe, 'Title EN': r.titleEn,
    'Prefix DE': r.prefixDe, 'Prefix EN': r.prefixEn,
    'Subtitle DE': r.subtitleDe, 'Subtitle EN': r.subtitleEn,
    'Dates DE': r.datesDe, 'Dates EN': r.datesEn,
    'Spots Label DE': r.spotsDe, 'Spots Label EN': r.spotsEn,
    Guests: r.guests,
    'Price DE': r.price, 'Price EN': r.price,
    'Deposit DE': r.deposit, 'Deposit EN': r.deposit,
    'Remaining DE': r.remainingDueDe, 'Remaining EN': r.remainingDueEn,
    'Lede DE': r.ledeDe, 'Lede EN': r.ledeEn,
    'Card Image': attachment(r.cardImage),
    'Hero Image': attachment(r.heroImage),
  };
}

function itineraryFields(day, retreatId, retreatSlug) {
  return {
    Name: `${retreatSlug} — ${String(day.dayNum).padStart(2, '0')} ${day.titleEn}`,
    Retreat: [retreatId],
    'Day Number': day.dayNum,
    'Day Label DE': day.dayDe,
    'Day Label EN': day.dayEn,
    'Title DE': day.titleDe,
    'Title EN': day.titleEn,
    'Body DE': day.bodyDe,
    'Body EN': day.bodyEn,
  };
}

// ---- Run -----------------------------------------------------------------
async function main() {
  console.log(`→ Base: ${BASE_ID}`);
  console.log(`→ Fetching existing Retreats rows (to skip duplicates)…`);
  const existing = await listAllRecords(RETREATS_TABLE);
  const existingBySlug = new Map(
    existing.map((rec) => [rec.fields.Slug, rec]).filter(([s]) => s)
  );
  console.log(`  found ${existing.length} existing rows (${existingBySlug.size} with a slug)`);

  // Create retreats
  const toCreate = retreats.filter((r) => !existingBySlug.has(r.slug));
  const skipped = retreats.filter((r) => existingBySlug.has(r.slug));
  for (const r of skipped) {
    console.log(`  skip ${r.slug} (already exists)`);
  }

  let createdRetreatRecords = [];
  if (toCreate.length) {
    console.log(`→ Creating ${toCreate.length} retreat rows…`);
    createdRetreatRecords = await createRecords(
      RETREATS_TABLE,
      toCreate.map((r) => ({ fields: retreatFields(r) })),
    );
    for (const rec of createdRetreatRecords) {
      console.log(`  + ${rec.fields.Slug} → ${rec.id}`);
    }
  }

  // Build a slug → recordId map combining skipped + created
  const slugToId = new Map();
  for (const rec of existing) {
    if (rec.fields.Slug) slugToId.set(rec.fields.Slug, rec.id);
  }
  for (const rec of createdRetreatRecords) {
    slugToId.set(rec.fields.Slug, rec.id);
  }

  // Create itinerary rows for any retreat that was just inserted.
  // For rows we skipped, we leave their itinerary alone.
  if (createdRetreatRecords.length) {
    console.log(`→ Fetching existing Retreat Itinerary rows…`);
    const existingItinerary = await listAllRecords(ITINERARY_TABLE);
    const existingByKey = new Set(
      existingItinerary
        .map((rec) => {
          const retreatLink = rec.fields.Retreat?.[0];
          const dayNum = rec.fields['Day Number'];
          return retreatLink && dayNum ? `${retreatLink}:${dayNum}` : null;
        })
        .filter(Boolean),
    );

    const itineraryRows = [];
    for (const r of toCreate) {
      const retreatId = slugToId.get(r.slug);
      if (!retreatId) continue;
      for (const day of sharedItinerary) {
        const key = `${retreatId}:${day.dayNum}`;
        if (existingByKey.has(key)) continue;
        itineraryRows.push({ fields: itineraryFields(day, retreatId, r.slug) });
      }
    }

    if (itineraryRows.length) {
      console.log(`→ Creating ${itineraryRows.length} itinerary rows…`);
      const createdItinerary = await createRecords(ITINERARY_TABLE, itineraryRows);
      console.log(`  + ${createdItinerary.length} rows created`);
    } else {
      console.log(`  no itinerary rows needed`);
    }
  }

  console.log(`\n✓ Done.`);
  console.log(`  Open Airtable: https://airtable.com/${BASE_ID}`);
}

main().catch((err) => {
  console.error('\nMigration failed:');
  console.error(err);
  process.exit(1);
});
