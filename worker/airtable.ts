// Airtable REST client — generic create + typed helpers for our two tables.
// Docs: https://airtable.com/developers/web/api/create-records

import type { BookingInput } from './validate';
import type { ContactInput } from './contact';
import type { Env } from './index';

export interface AirtableResult {
  ok: boolean;
  recordId?: string;
  displayId?: string; // Booking ID or Contact ID, whichever the table has
  error?: string;
}

async function createRecord(
  tableName: string,
  fields: Record<string, unknown>,
  env: Env,
  displayIdField?: string,
): Promise<AirtableResult> {
  const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(
    tableName,
  )}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{ fields }],
        typecast: true, // let Airtable create missing select options on-the-fly
      }),
    });
  } catch (e) {
    return { ok: false, error: `network: ${(e as Error).message}` };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      ok: false,
      error: `airtable ${response.status}: ${text.slice(0, 500)}`,
    };
  }

  const body = (await response.json()) as {
    records?: Array<{ id: string; fields?: Record<string, unknown> }>;
  };
  const record = body.records?.[0];
  if (!record?.id) {
    return { ok: false, error: 'airtable: no record id returned' };
  }

  return {
    ok: true,
    recordId: record.id,
    displayId: displayIdField
      ? (record.fields?.[displayIdField] as string) || record.id
      : record.id,
  };
}

// -- Booking record --------------------------------------------------------

export function createBookingRecord(input: BookingInput, env: Env): Promise<AirtableResult> {
  const fields = {
    'Status': 'New',
    'Retreat code': input.retreatCode,
    'Retreat title': input.retreatTitle,
    'Guest name': input.name,
    'Guest email': input.email,
    'Guests': input.guests,
    'Dates': input.dates,
    'Message': input.message,
    'Source': 'website',
    'Lang': input.lang,
  };
  return createRecord(env.AIRTABLE_TABLE_NAME, fields, env, 'Booking ID');
}

// -- Contact record --------------------------------------------------------

export function createContactRecord(input: ContactInput, env: Env): Promise<AirtableResult> {
  const fields = {
    'Status': 'New',
    'Name': input.name,
    'Email': input.email,
    'Retreat interest': input.retreatInterest,
    'Message': input.message,
    'Source': 'website-contact',
    'Lang': input.lang,
  };
  return createRecord(env.AIRTABLE_CONTACTS_TABLE, fields, env, 'Contact ID');
}
