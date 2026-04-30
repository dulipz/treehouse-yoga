#!/usr/bin/env node
// Prefetches all retreat attachments (Card Image, Hero Image) from Airtable
// into public/assets/cms/ BEFORE astro build runs.
//
// Why: Astro's Vite copies public/ → dist/ early in the build, before our
// async data layer runs. If we wait until the data layer to download images,
// the files land in public/ but miss the public→dist copy and never make it
// into the deployed bundle. Running this script first ensures every image
// is on disk before astro build starts.
//
// Cache: files are keyed by attachment ID, so a new upload in Airtable gets
// a new filename and triggers a fresh download. Previously-downloaded files
// are reused.
//
// Usage:
//   node scripts/prefetch-retreat-images.mjs
//   AIRTABLE_TOKEN=pat... node scripts/prefetch-retreat-images.mjs

import { readFileSync, existsSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const PUBLIC_CMS_DIR = join(repoRoot, 'public', 'assets', 'cms');

// ---- env -----------------------------------------------------------------
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
  console.error('[prefetch] AIRTABLE_TOKEN not set; skipping image prefetch.');
  // Don't fail the build — astro build will throw a clearer error if needed.
  process.exit(0);
}

const BASE_ID = 'appIFPQ3y33OFocaO';
const RETREATS_TABLE = 'Retreats';

// ---- Airtable list -------------------------------------------------------
async function airtableList(table) {
  const out = [];
  let offset;
  do {
    const qs = new URLSearchParams();
    qs.set('pageSize', '100');
    if (offset) qs.set('offset', offset);
    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}?${qs}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) {
      throw new Error(`Airtable list ${table} → ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

// ---- Image download ------------------------------------------------------
function extFromAttachment(att) {
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

async function ensureLocalImage(att, slug, kind) {
  if (!att?.url) return null;
  const ext = extFromAttachment(att);
  const filename = `${slug}-${kind}-${att.id}.${ext}`;
  const fsPath = join(PUBLIC_CMS_DIR, filename);

  try {
    const s = await stat(fsPath);
    if (s.size > 0) return { filename, status: 'cached' };
  } catch {
    // not present
  }

  await mkdir(PUBLIC_CMS_DIR, { recursive: true });
  const res = await fetch(att.url);
  if (!res.ok) {
    console.warn(`[prefetch] download failed (${res.status}) for ${slug}/${kind}`);
    return { filename, status: 'failed' };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(fsPath, buf);
  return { filename, status: 'downloaded' };
}

// ---- Slug check ----------------------------------------------------------
function isValidSlug(s) {
  return typeof s === 'string' && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s);
}

// ---- Run -----------------------------------------------------------------
async function main() {
  console.log('[prefetch] fetching retreats…');
  const records = await airtableList(RETREATS_TABLE);
  console.log(`[prefetch] ${records.length} retreats`);

  let downloaded = 0;
  let cached = 0;
  let failed = 0;

  for (const rec of records) {
    const slug = rec.fields.Slug;
    if (!isValidSlug(slug)) {
      console.warn(`[prefetch] skip — invalid Slug: "${slug}"`);
      continue;
    }
    const card = rec.fields['Card Image']?.[0];
    const hero = rec.fields['Hero Image']?.[0];
    for (const [att, kind] of [[card, 'card'], [hero, 'hero']]) {
      const result = await ensureLocalImage(att, slug, kind);
      if (!result) continue;
      if (result.status === 'downloaded') {
        console.log(`  + ${result.filename}`);
        downloaded++;
      } else if (result.status === 'cached') {
        cached++;
      } else {
        failed++;
      }
    }
  }

  console.log(
    `[prefetch] done — ${downloaded} downloaded, ${cached} cached, ${failed} failed`,
  );
}

main().catch((err) => {
  console.error('[prefetch] failed:', err);
  process.exit(1);
});
