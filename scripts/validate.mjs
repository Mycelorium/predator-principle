import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const errors = [];
const warnings = [];

const [claims, sources, queue, campaign, autopilot, publishingState] = await Promise.all([
  readJson('docs/data/claims.json'),
  readJson('docs/data/sources.json'),
  readJson('content/queue.json'),
  readJson('content/campaign.json'),
  readJson('content/autopilot.json'),
  readJson('content/publishing-state.json')
]);

const unique = (items) => new Set(items).size === items.length;
const sourceIds = new Set(sources.map((source) => source.id));
const claimIds = new Set(claims.map((claim) => claim.id));

if (!unique(claims.map((claim) => claim.id))) errors.push('Claim IDs must be unique.');
if (!unique(sources.map((source) => source.id))) errors.push('Source IDs must be unique.');

for (const claim of claims) {
  if (!/^C\d{3}$/.test(claim.id)) errors.push(`${claim.id}: invalid claim ID.`);
  if (!['E', 'I', 'P'].includes(claim.class)) errors.push(`${claim.id}: class must be E, I, or P.`);
  for (const field of ['title_de', 'title_en', 'claim_de', 'claim_en', 'boundary_de', 'boundary_en', 'falsifier_de', 'falsifier_en']) {
    if (!claim[field]?.trim()) errors.push(`${claim.id}: missing ${field}.`);
  }
  for (const sourceId of claim.sources || []) {
    if (!sourceIds.has(sourceId)) errors.push(`${claim.id}: unknown source ${sourceId}.`);
  }
  if (claim.class === 'E' && !(claim.sources || []).length) {
    errors.push(`${claim.id}: empirical claims require at least one source.`);
  }
  if (claim.class === 'P' && claim.status === 'supported') {
    warnings.push(`${claim.id}: proposition is marked supported; consider reclassification.`);
  }
}

for (const source of sources) {
  if (!/^S\d{3}$/.test(source.id)) errors.push(`${source.id}: invalid source ID.`);
  if (!source.title || !source.url || !source.year) errors.push(`${source.id}: missing title, URL, or year.`);
  if (!source.url.startsWith('https://')) errors.push(`${source.id}: source URL must use HTTPS.`);
}

for (const item of queue) {
  if (!item.id || !item.title || !item.body) errors.push('Every queue item needs id, title, and body.');
  if (!Array.isArray(item.claim_ids) || !item.claim_ids.length) {
    errors.push(`${item.id || 'queue item'}: at least one claim ID is required.`);
  } else {
    for (const claimId of item.claim_ids) {
      if (!claimIds.has(claimId)) errors.push(`${item.id}: unknown claim ${claimId}.`);
    }
  }
  if (item.approved === true && !item.reviewed_by?.trim()) {
    errors.push(`${item.id}: approved content requires a named reviewer.`);
  }
}

if (!unique(campaign.map((item) => item.id))) errors.push('Campaign IDs must be unique.');
if (!unique(campaign.map((item) => item.sequence))) errors.push('Campaign sequence numbers must be unique.');
for (const item of campaign) {
  if (!Number.isInteger(item.sequence) || item.sequence < 1) errors.push(`${item.id}: invalid campaign sequence.`);
  if (!['E', 'I', 'P'].includes(item.class)) errors.push(`${item.id}: campaign class must be E, I, or P.`);
  for (const field of ['title_de', 'title_en', 'hook_de', 'hook_en', 'boundary_de', 'boundary_en']) {
    if (!item[field]?.trim()) errors.push(`${item.id}: missing ${field}.`);
  }
  for (const field of ['body_de', 'body_en']) {
    if (!Array.isArray(item[field]) || !item[field].length || item[field].some((paragraph) => !paragraph.trim())) {
      errors.push(`${item.id}: ${field} must contain non-empty paragraphs.`);
    }
  }
  for (const claimId of item.claim_ids || []) {
    if (!claimIds.has(claimId)) errors.push(`${item.id}: unknown campaign claim ${claimId}.`);
  }
  for (const sourceId of item.source_ids || []) {
    if (!sourceIds.has(sourceId)) errors.push(`${item.id}: unknown campaign source ${sourceId}.`);
  }
  if (item.class === 'E' && !(item.source_ids || []).length) {
    errors.push(`${item.id}: empirical campaign items require a source.`);
  }
  if (item.approved === true && !item.approved_by?.trim()) {
    errors.push(`${item.id}: approved campaign item requires approval mandate.`);
  }
}
for (const entry of publishingState.published || []) {
  if (!campaign.some((item) => item.id === entry.id)) errors.push(`Publishing state references unknown campaign item ${entry.id}.`);
}
if (autopilot.enabled && !autopilot.approval_mandate?.trim()) errors.push('Enabled autopilot requires an approval mandate.');
if (!/^https:\/\//.test(autopilot.base_url || '')) errors.push('Autopilot base_url must use HTTPS.');

for (const path of ['docs/index.html', 'docs/styles.css', 'docs/app.js', 'docs/llms.txt', 'docs/feed.xml', 'docs/feed.json', 'docs/sitemap.xml', 'docs/posts/index.html', 'corpus/systems-hypothesis.md', 'corpus/evidence-map.md']) {
  try { await access(new URL(path, root)); } catch { errors.push(`Required file missing: ${path}`); }
}

for (const warning of warnings) console.warn(`WARNING: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${claims.length} claims, ${sources.length} sources, ${queue.length} queued drafts, and ${campaign.length} autopilot dispatches.`);
