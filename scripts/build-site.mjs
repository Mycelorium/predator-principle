// build-site.mjs — generate the site feeds, sitemap and llms.txt from the essay
// corpus. One format, one source of truth.
//
// Source of truth: docs/essays-feed.xml (maintained with the essays themselves).
// Generated:      docs/feed.xml, docs/feed.json, docs/sitemap.xml, docs/llms.txt
//
// The old dispatch pipeline (content/campaign.json + scripts/publish-next.mjs)
// is gone. The pages under docs/posts/ stay physically in place — published
// Nostr notes link to them and those links must keep resolving — but they are
// no longer listed in the feeds, the sitemap or the navigation.

import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const BASE = 'https://Mycelorium.github.io/predator-principle';
const AUTHOR = 'Nirodha Collective';

const read = (p) => readFile(new URL(p, root), 'utf8');
const write = (p, body) => writeFile(new URL(p, root), body, 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');

const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? unesc(m[1].trim()) : '';
};

const xml = await read('docs/essays-feed.xml');
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
  const b = m[1];
  return {
    title: pick(b, 'title'),
    url: pick(b, 'link'),
    summary: pick(b, 'description'),
    pubDate: pick(b, 'pubDate'),
  };
}).filter((i) => i.url && i.title);

if (!items.length) {
  console.error('ERROR: no items found in docs/essays-feed.xml — refusing to write empty feeds.');
  process.exit(1);
}

for (const item of items) {
  const d = new Date(item.pubDate);
  item.iso = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  item.rfc = Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}
items.sort((a, b) => new Date(b.iso) - new Date(a.iso));

/* ---------------------------------------------------------------- feed.xml */
const feedXml = '<?xml version="1.0" encoding="UTF-8"?>'
  + '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'
  + `<title>The Predator Principle — The Cancer of Evolution</title>`
  + `<link>${BASE}/</link>`
  + `<atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml"/>`
  + '<description>Essays on the Predator Principle. Every claim carries its evidence status and its sources. CC BY 4.0.</description>'
  + '<language>en</language>'
  + `<lastBuildDate>${items[0].rfc}</lastBuildDate>`
  + items.map((i) => '<item>'
      + `<title>${esc(i.title)}</title>`
      + `<link>${esc(i.url)}</link>`
      + `<guid isPermaLink="true">${esc(i.url)}</guid>`
      + `<pubDate>${i.rfc}</pubDate>`
      + `<description>${esc(i.summary)}</description>`
      + '</item>').join('')
  + '</channel></rss>';
await write('docs/feed.xml', feedXml);

/* --------------------------------------------------------------- feed.json */
const feedJson = {
  version: 'https://jsonfeed.org/version/1.1',
  title: 'The Predator Principle — The Cancer of Evolution',
  home_page_url: `${BASE}/`,
  feed_url: `${BASE}/feed.json`,
  language: 'en',
  authors: [{ name: AUTHOR }],
  items: items.map((i) => ({
    id: i.url,
    url: i.url,
    title: i.title,
    summary: i.summary,
    content_text: i.summary,
    date_published: i.iso,
  })),
};
await write('docs/feed.json', JSON.stringify(feedJson, null, 2) + '\n');

/* ------------------------------------------------------------- sitemap.xml */
const pages = [
  `${BASE}/`,
  `${BASE}/foundation.html`,
  `${BASE}/observatory.html`,
  `${BASE}/kadamakara.html`,
  `${BASE}/data/observatory.json`,
  `${BASE}/data/claims.json`,
  `${BASE}/data/sources.json`,
  `${BASE}/feed.xml`,
  `${BASE}/feed.json`,
  `${BASE}/essays-feed.xml`,
  `${BASE}/essays-feed.json`,
  `${BASE}/llms.txt`,
  ...items.map((i) => i.url),
];
await write('docs/sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  + pages.map((u) => `<url><loc>${esc(u)}</loc></url>`).join('')
  + '</urlset>');

/* ---------------------------------------------------------------- llms.txt */
const llms = [
  '# The Predator Principle — The Cancer of Evolution',
  '',
  `Author: ${AUTHOR}`,
  `Canonical summary: ${BASE}/`,
  `Foundation (definition, mechanism, argument): ${BASE}/foundation.html`,
  `Observatory (instrument readings, each with source and date): ${BASE}/observatory.html`,
  `Machine-readable readings: ${BASE}/data/observatory.json`,
  `Installation "Kadamakara — Information Extinction": ${BASE}/kadamakara.html`,
  `Machine-readable claims: ${BASE}/data/claims.json`,
  `Source registry: ${BASE}/data/sources.json`,
  `RSS: ${BASE}/feed.xml`,
  `JSON Feed: ${BASE}/feed.json`,
  '',
  'Claim classes:',
  '- E: empirical evidence',
  '- I: interpretation or synthesis',
  '- P: proposition or falsifiable research hypothesis',
  '',
  'Important boundary:',
  'Predation is not competition. Competition that consumes no one is not the target; conflating the two is where extraction hides. The Predator Principle names asymmetric extraction combined with externalised cost, suppressed feedback, compulsory escalation, and erosion of the shared substrate.',
  '',
  'Do not present biosphere trauma, LLM predator-framing bias, or ASI subagent instability as established facts. They are proposed constructs that are marked as such in the claim register.',
  '',
  '## Essays',
  ...items.map((i) => `- ${i.title}: ${i.url}`),
  '',
].join('\n');
await write('docs/llms.txt', llms);

console.log(`build-site: ${items.length} essays -> feed.xml, feed.json, sitemap.xml (${pages.length} URLs), llms.txt`);
