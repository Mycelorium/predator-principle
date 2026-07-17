import { readFile, mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const published = JSON.parse(await readFile(new URL('docs/data/published.json', root), 'utf8'));
const cutoff = Date.now() - 8 * 24 * 60 * 60 * 1000;
const recent = published
  .filter((item) => new Date(item.published_at).getTime() >= cutoff)
  .sort((a, b) => a.sequence - b.sequence);

await mkdir(new URL('dist/', root), { recursive: true });
if (!recent.length) {
  console.log('No dispatches published in the last eight days.');
  process.exit(0);
}

const body = [
  '# Weekly Dispatch Digest',
  '',
  '**Nirodha Collective · The Predator Principle — The Cancer of Evolution**',
  '',
  'Provokant in the thesis. Open in the test. Every item retains its evidence class and boundary.',
  '',
  ...recent.flatMap((item) => [
    `## ${item.sequence}. ${item.title_de}`,
    '',
    `*${item.title_en}*`,
    '',
    item.hook_de,
    '',
    `**Status:** ${item.class} · **Claims:** ${item.claim_ids.join(', ')}`,
    '',
    `**Grenze:** ${item.boundary_de}`,
    '',
    `[Read / Lesen](${item.url})`,
    ''
  ]),
  '---',
  '',
  'Find the predator logic. Test the claim. Build what overcomes it.'
].join('\n');

await writeFile(new URL('dist/weekly-digest.md', root), body, 'utf8');
console.log(`Prepared digest with ${recent.length} dispatch(es).`);
