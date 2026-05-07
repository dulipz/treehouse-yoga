// Rooms data layer.
//
// Reads the "Rooms" table from Airtable at build time. Each room maps to one of
// the 5 villa rooms (iris, chantal, dulip, patricia, philipp). The "Retreats"
// linked field on a room indicates which retreats it's bookable for, so the
// /retreats/[slug] booking modal only shows applicable rooms.
//
// Availability ("which rooms are already booked") is computed at runtime by
// the Worker route /api/availability — not here, since this module runs
// at build time only.

interface Bilingual {
  de: string;
  en: string;
}

export type RoomCapacity = 'single only' | 'single + double';

export interface Room {
  /** URL slug — also the primary field in Airtable, used for cross-table linking */
  slug: string;
  name: Bilingual;
  description: Bilingual;
  capacity: RoomCapacity;
  /** Per-person price for single occupancy (€). Required. */
  priceSingle: number;
  /** Per-person price for double occupancy (€). Null when capacity is 'single only'. */
  priceDouble: number | null;
  /** Sort order — smaller first */
  order: number;
  /** Public attachment URL for the room's hero/card image, if uploaded */
  cardImage: string | null;
  /** Airtable record IDs of retreats this room is offered for */
  retreatRecordIds: string[];
}

const BASE_ID = 'appIFPQ3y33OFocaO';
const ROOMS_TABLE = 'Rooms';

let cache: Promise<Room[]> | null = null;

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
      throw new Error(`Airtable list ${table} → ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function n(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function bilingual(de: unknown, en: unknown): Bilingual {
  return { de: s(de), en: s(en) };
}

function capacityFromAirtable(v: unknown): RoomCapacity {
  // Normalise — Airtable single-select values can pick up casing or spacing
  // variants depending on how the user typed them. Treat any string that
  // mentions "single" without "double" as single-only.
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (s.indexOf('double') !== -1) return 'single + double';
  if (s.indexOf('single') !== -1) return 'single only';
  return 'single + double'; // safe default — keeps room visible
}

async function loadFromAirtable(): Promise<Room[]> {
  const token = (import.meta.env.AIRTABLE_TOKEN as string | undefined)
    ?? process.env.AIRTABLE_TOKEN;
  if (!token) {
    // Match the retreats data layer: hard fail at build time so deploy doesn't
    // ship empty room data accidentally.
    throw new Error(
      '[rooms] AIRTABLE_TOKEN is not set. Add it to .env.local or export it before `npm run build`.',
    );
  }

  const records = await airtableList(ROOMS_TABLE, token);

  const rooms: Room[] = records
    .filter((r) => r.fields.Active === true) // skip retired rooms
    .map((rec) => {
      const f = rec.fields;
      const cardAtts = (f['Card Image'] as AirtableAttachment[] | undefined) ?? [];
      const retreatLinks = (f['Retreats'] as string[] | undefined) ?? [];

      return {
        slug: s(f.Slug),
        name: bilingual(f['Name DE'], f['Name EN']),
        description: bilingual(f['Description DE'], f['Description EN']),
        capacity: capacityFromAirtable(f.Capacity),
        priceSingle: n(f['Price Single']) ?? 0,
        priceDouble: n(f['Price Double']),
        order: n(f.OrderNumber) ?? 999,
        cardImage: cardAtts[0]?.url ?? null,
        retreatRecordIds: retreatLinks,
      };
    })
    .filter((r) => r.slug.length > 0);

  rooms.sort((a, b) => a.order - b.order);
  return rooms;
}

export async function getRooms(): Promise<Room[]> {
  if (!cache) cache = loadFromAirtable();
  return cache;
}

/**
 * Rooms offered for a specific retreat by Airtable record ID.
 * Used at build time to bake a per-retreat room list into the page.
 */
export async function getRoomsForRetreat(retreatRecordId: string): Promise<Room[]> {
  const all = await getRooms();
  return all.filter((r) => r.retreatRecordIds.includes(retreatRecordId));
}
