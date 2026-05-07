// GET /api/availability?retreat=<slug>
//
// Reads the Bookings table from Airtable and returns the list of room slugs
// already booked for the given retreat. The booking modal calls this on open
// (and on retreat change) and removes those rooms from the dropdown.
//
// Privacy: this endpoint only ever returns room slugs — never names, emails,
// or any PII from the Bookings table. The endpoint is publicly callable but
// only exposes "marketing-level" availability info.

import type { Env } from './index';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

const ROOMS_TABLE = 'Rooms';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export async function handleAvailability(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const retreatSlug = (url.searchParams.get('retreat') ?? '').trim().toLowerCase();

  if (!SLUG_RE.test(retreatSlug)) {
    return jsonResp({ ok: false, error: 'invalid_retreat' }, 400);
  }

  // Pull bookings filtered by retreat. We use the "Retreat code" string field
  // on the Bookings table — that's where the modal writes the retreat slug.
  // Bookings with status "Cancelled" don't count toward "taken".
  const bookingsTable = env.AIRTABLE_TABLE_NAME;
  const formula = `AND({Retreat code}='${retreatSlug.replace(/'/g, "\\'")}',NOT({Status}='Cancelled'))`;

  let records: AirtableRecord[];
  try {
    records = await airtableList(env, bookingsTable, formula);
  } catch (e) {
    console.error('[availability] bookings list failed:', (e as Error).message);
    return jsonResp({ ok: false, error: 'storage_failed' }, 502);
  }

  // Each booking has a "Room" linked-record field — array of Airtable record
  // IDs. We need the slugs of those rooms. Two ways to get there:
  //   1) Pull all rooms once, build a recordId→slug map, then translate.
  //      Simple, one extra round trip, fine for our 5-room table.
  //   2) Use Airtable's `lookup` field type to denormalise slug onto Bookings.
  //      Avoids the round trip but requires schema change on the user's side.
  // Going with (1) — keeps the schema lean.
  const linkedRoomIds = new Set<string>();
  for (const rec of records) {
    const ids = rec.fields.Room as string[] | undefined;
    if (Array.isArray(ids)) {
      for (const id of ids) linkedRoomIds.add(id);
    }
  }

  if (linkedRoomIds.size === 0) {
    return jsonResp({ ok: true, booked: [] });
  }

  let roomRecords: AirtableRecord[];
  try {
    roomRecords = await airtableList(env, ROOMS_TABLE);
  } catch (e) {
    console.error('[availability] rooms list failed:', (e as Error).message);
    return jsonResp({ ok: false, error: 'storage_failed' }, 502);
  }

  const booked: string[] = [];
  for (const rec of roomRecords) {
    if (!linkedRoomIds.has(rec.id)) continue;
    const slug = typeof rec.fields.Slug === 'string' ? rec.fields.Slug.trim() : '';
    if (slug) booked.push(slug);
  }

  return jsonResp({ ok: true, booked }, 200, {
    // Short edge cache so a quick double-open of the modal doesn't hammer Airtable,
    // but stale-while-revalidate keeps it close to real-time.
    'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
  });
}

async function airtableList(
  env: Env,
  table: string,
  filterByFormula?: string,
): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams();
    qs.set('pageSize', '100');
    if (filterByFormula) qs.set('filterByFormula', filterByFormula);
    if (offset) qs.set('offset', offset);
    const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?${qs}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` },
    });
    if (!res.ok) {
      throw new Error(`Airtable list ${table} → ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

function jsonResp(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}
