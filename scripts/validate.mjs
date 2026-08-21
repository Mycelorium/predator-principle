// validate.mjs — gate for every workflow. Runs FIRST everywhere, so a false
// failure here silently stops all publishing. Keep it strict about the claim
// register and forgiving about everything else.
//
// History: this file once required a file that had been deleted, and the whole
// site went quiet for eight days without a single alert. Whenever something
// under docs/ is removed, check the required-files list at the bottom.

import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const errors = [];
const warnings = [];

const [claims, sources] = await Promise.all([
  readJson('docs/data/claims.json'),
  readJson('docs/data/sources.json')
]);

const unique = (items) => new Set(items).size === items.length;
const sourceIds = new Set(sources.map((source) => source.id));

if (!unique(claims.map((claim) => claim.id))) errors.push('Claim IDs must be unique.');
if (!unique(sources.map((source) => source.id))) errors.push('Source IDs must be unique.');

for (const claim of claims) {
  if (!/^C\d{3}$/.test(claim.id)) errors.push(`${claim.id}: invalid claim ID.`);
  for (const field of ['title_en', 'claim_en', 'boundary_en', 'falsifier_en']) {
    if (!claim[field]?.trim()) errors.push(`${claim.id}: missing ${field}.`);
  }
  for (const sourceId of claim.sources || []) {
    if (!sourceIds.has(sourceId)) errors.push(`${claim.id}: unknown source ${sourceId}.`);
  }
  if (!(claim.sources || []).length && claim.status === 'supported') {
    errors.push(`${claim.id}: a supported claim requires at least one source.`);
  }
}

for (const source of sources) {
  if (!/^S\d{3}$/.test(source.id)) errors.push(`${source.id}: invalid source ID.`);
  if (!source.title || !source.url || !source.year) errors.push(`${source.id}: missing title, URL, or year.`);
  if (!source.url.startsWith('https://')) errors.push(`${source.id}: source URL must use HTTPS.`);
}

// The essay corpus is the one published format and the source of truth for the
// generated feeds, so it must exist and must not be empty.
let essayCount = 0;
try {
  const essaysFeed = await readJson('docs/essays-feed.json');
  essayCount = (essaysFeed.items || []).length;
  if (!essayCount) errors.push('docs/essays-feed.json contains no items.');
} catch {
  errors.push('Required file missing or unreadable: docs/essays-feed.json');
}

for (const path of [
  'docs/index.html',
  'docs/foundation.html',
  'docs/kadamakara.html',
  'docs/observatory.html',
  'docs/data/observatory.json',
  'docs/data/recognition.json',
  'docs/styles.css',
  'docs/llms.txt',
  'docs/feed.xml',
  'docs/feed.json',
  'docs/essays-feed.xml',
  'docs/sitemap.xml',
  'corpus/systems-hypothesis.md',
  'corpus/evidence-map.md',
]) {
  try { await access(new URL(path, root)); } catch { errors.push(`Required file missing: ${path}`); }
}

for (const warning of warnings) console.warn(`WARNING: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${claims.length} claims, ${sources.length} sources, and ${essayCount} published essays.`);
