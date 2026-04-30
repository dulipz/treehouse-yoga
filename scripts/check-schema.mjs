#!/usr/bin/env node
// Prints the exact field names in the Retreats and Retreat Itinerary tables
// so we can see what the migration script needs to match.
//
// Usage:
//   AIRTABLE_TOKEN=pat... node scripts/check-schema.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = resolve(repoRoot, '.env.local');
  if (!existsSync(envPath)) return;
  const txt = readFileSync(envPath, 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (!(k in process.env)) process.env[k] = v.replace(/^['"]|['"]$/g, '');
  }
}
loadEnvLocal();

const TOKEN = process.env.AIRTABLE_TOKEN;
if (!TOKEN) {
  console.error('Missing AIRTABLE_TOKEN');
  process.exit(1);
}

const BASE_ID = 'appIFPQ3y33OFocaO';

async function main() {
  // Try the metadata API first (needs schema.bases:read scope)
  const metaRes = await fetch(
    `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );

  if (metaRes.ok) {
    const data = await metaRes.json();
    for (const t of data.tables) {
      console.log(`\n=== ${t.name} ===`);
      for (const f of t.fields) {
        console.log(`  • ${f.name}  (${f.type})`);
      }
    }
    return;
  }

  // Fallback: list a single record and dump its field keys
  console.log(
    `(metadata API returned ${metaRes.status}; falling back to record probe)\n`,
  );
  for (const table of ['Retreats', 'Retreat Itinerary']) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}?maxRecords=1`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) {
      console.log(`${table}: ${res.status} ${await res.text()}`);
      continue;
    }
    const data = await res.json();
    const rec = data.records?.[0];
    console.log(`\n=== ${table} ===`);
    if (!rec) {
      console.log('  (no rows — cannot introspect field names without a row)');
      console.log('  add a dummy row with one cell filled in each column, then re-run');
    } else {
      for (const k of Object.keys(rec.fields)) console.log(`  • ${k}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
