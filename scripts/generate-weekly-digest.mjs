// generate-weekly-digest.mjs — English-only weekly digest of what was published.
//
// The site is English. The digest used to render German first with the English
// title in italics underneath, which is why the release notes read bilingual
// long after the site stopped being so.

import { readFile, mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const published = JSON.parse(await readFile(new URL('docs/data/published.json', root), 'utf8'));
const cutoff = Date.now() - 8 * 24 * 60 * 60 * 1000;
const recent = published
  .filter((item) => new Date(item.published_at).getTime() >= cutoff)
  .sort((a, b) => a.sequence - b.sequence);

await mkdir(new URL('dist/', root), { recursive: true });
if (!recent.length) {
  console.log('Nothing published in the last eight days.');
  process.exit(0);
}

const body = [
  '# Weekly Digest',
  '',
  '**Nirodha Collective · The Predator Principle — The Cancer of Evolution**',
  '',
  'Provocative in the thesis. Open in the test. Every item keeps its evidence class and its boundary.',
  '',
  ...recent.flatMap((item) => [
    `## ${item.sequence}. ${item.title_en}`,
    '',
    item.hook_en,
    '',
    `**Status:** ${item.class} · **Claims:** ${item.claim_ids.join(', ')}`,
    '',
    `**Boundary:** ${item.boundary_en}`,
    '',
    `[Read it](${item.url})`,
    '',
  ]),
  '---',
  '',
  'Find the predator logic. Test the claim. Build what overcomes it.',
].join('\n');

await writeFile(new URL('dist/weekly-digest.md', root), body, 'utf8');
console.log(`Prepared digest with ${recent.length} item(s).`);
