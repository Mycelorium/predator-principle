import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const load = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const save = async (path, value) => writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const html = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const xml = html;
const now = new Date();
const nowIso = now.toISOString();
const dryRun = process.env.DRY_RUN === '1';

// Essay pages live alongside the dispatches; keep them in the sitemap so autopilot
// runs never drop them. English-only site (translations handled separately).
const ESSAY_SLUGS = [
  'horror-in-the-cambrian', 'the-predators-filter', 'the-mistake-that-eats-itself',
  'we-are-the-meteorite', 'the-trauma-that-still-runs', 'dyson-sphere-self-portrait',
  'the-romanticism-of-predation', 'predation-is-not-competition', 'the-ground-was-never-the-tooth'
];

const [config, campaign, state, claims, sources] = await Promise.all([
  load('content/autopilot.json'),
  load('content/campaign.json'),
  load('content/publishing-state.json'),
  load('docs/data/claims.json'),
  load('docs/data/sources.json')
]);

if (!config.enabled) {
  console.log('Autopilot is disabled.');
  process.exit(0);
}

const publishedIds = new Set(state.published.map((entry) => entry.id));
const ready = campaign
  .filter((item) => item.approved === true && !publishedIds.has(item.id))
  .sort((a, b) => a.sequence - b.sequence)
  .slice(0, config.posts_per_run || 1);

const nothingNew = ready.length === 0;
if (nothingNew) {
  console.log('No approved unpublished items remain; refreshing English site outputs only.');
}

for (const item of ready) {
  if (!item.approved_by?.trim()) throw new Error(`${item.id}: approved campaign item has no approval mandate.`);
}

if (dryRun) {
  console.log(nothingNew ? 'DRY RUN: nothing new to publish.' : `DRY RUN: would publish ${ready.map((item) => item.id).join(', ')}.`);
  process.exit(0);
}

const sourceMap = new Map(sources.map((source) => [source.id, source]));
const claimMap = new Map(claims.map((claim) => [claim.id, claim]));
const published = await load('docs/data/published.json');
await mkdir(new URL('docs/posts/', root), { recursive: true });
await mkdir(new URL('dist/', root), { recursive: true });

// ENGLISH-ONLY dispatch page.
const postDocument = (item, publishedAt) => {
  const url = `${config.base_url}/posts/${item.id}.html`;
  const sourcesHtml = item.source_ids.map((id) => {
    const source = sourceMap.get(id);
    return source ? `<li><a href="${html(source.url)}" rel="noopener">${id} · ${html(source.title)}</a></li>` : '';
  }).join('');
  const claimsHtml = item.claim_ids.map((id) => {
    const claim = claimMap.get(id);
    return `<a class="post-chip" href="../#evidence">${html(item.class)}:${html(id)}${claim ? ` · ${html(claim.status)}` : ''}</a>`;
  }).join('');
  const section = `<section class="post-language" lang="en">
    <p class="eyebrow">NIRODHA COLLECTIVE · DISPATCH</p>
    <h1>${html(item.title_en)}</h1>
    <p class="post-hook">${html(item.hook_en)}</p>
    ${item.body_en.map((paragraph) => `<p>${html(paragraph)}</p>`).join('\n')}
    <aside class="post-boundary"><strong>Evidence boundary · ${html(item.class)}</strong><p>${html(item.boundary_en)}</p></aside>
  </section>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${html(item.title_en)} · The Predator Principle — The Cancer of Evolution</title>
  <meta name="description" content="${html(item.hook_en)}">
  <link rel="canonical" href="${html(url)}">
  <link rel="alternate" type="application/rss+xml" title="Predator Principle Dispatches" href="../feed.xml">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="en_US">
  <meta property="og:title" content="${html(item.title_en)}">
  <meta property="og:description" content="${html(item.hook_en)}">
  <meta property="og:url" content="${html(url)}">
  <meta property="og:image" content="${html(config.base_url)}/og-card.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="../styles.css">
  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: item.title_en, inLanguage: 'en', datePublished: publishedAt, author: { '@type': 'Organization', name: config.author }, url })}</script>
</head>
<body>
  <header class="post-top"><a href="../">← The Predator Principle — The Cancer of Evolution</a><a href="./">All dispatches</a></header>
  <main class="post-main">
    <div class="post-meta"><span>NO. ${String(item.sequence).padStart(2, '0')}</span><time datetime="${publishedAt}">${publishedAt.slice(0, 10)}</time></div>
    ${section}
    <section class="post-evidence">
      <h2>Claims &amp; sources</h2>
      <div class="post-chips">${claimsHtml}</div>
      ${sourcesHtml ? `<ol>${sourcesHtml}</ol>` : '<p>This is a proposition to test; no empirical source is claimed for the proposition itself.</p>'}
    </section>
    <section class="post-share">
      <h2>Challenge it. Share it.</h2>
      <p>Replicate, refute, improve. Do not repeat the claim without its evidence boundary.</p>
      <button type="button" id="share">Share</button>
      <button type="button" id="copy">Copy link</button>
      <span id="copy-status" role="status"></span>
    </section>
  </main>
  <footer><p>© Nirodha Collective · Claim-linked public research</p><a href="../feed.xml">RSS</a></footer>
  <script>
    const url = location.href;
    document.getElementById('share').addEventListener('click', async () => {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else await navigator.clipboard.writeText(url);
    });
    document.getElementById('copy').addEventListener('click', async () => {
      await navigator.clipboard.writeText(url);
      document.getElementById('copy-status').textContent = 'Copied';
    });
  </script>
</body>
</html>`;
};

for (const item of ready) {
  const entry = {
    ...item,
    published_at: nowIso,
    url: `${config.base_url}/posts/${item.id}.html`
  };
  published.unshift(entry);
  state.published.push({ id: item.id, sequence: item.sequence, published_at: nowIso });
}

// Re-render EVERY published dispatch page in English (self-heals older bilingual pages).
for (const item of published) {
  await writeFile(new URL(`docs/posts/${item.id}.html`, root), postDocument(item, item.published_at || nowIso), 'utf8');
}

state.last_published_at = nowIso;
if (nothingNew && !state.campaign_completed_at) state.campaign_completed_at = nowIso;
await save('docs/data/published.json', published);
await save('content/publishing-state.json', state);
await save('dist/published-this-run.json', ready.map((item) => ({
  id: item.id,
  title_en: item.title_en,
  hook_en: item.hook_en,
  class: item.class,
  claim_ids: item.claim_ids,
  url: `${config.base_url}/posts/${item.id}.html`,
  published_at: nowIso
})));

const archiveItems = published.map((item) => `<article class="archive-item">
  <span>${String(item.sequence).padStart(2, '0')} · ${html(item.class)}</span>
  <h2><a href="${html(item.id)}.html">${html(item.title_en)}</a></h2>
  <p>${html(item.hook_en)}</p>
</article>`).join('\n');

await writeFile(new URL('docs/posts/index.html', root), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dispatches · The Predator Principle — The Cancer of Evolution</title><meta name="description" content="Claim-linked dispatches from Nirodha Collective."><link rel="alternate" type="application/rss+xml" title="Predator Principle Dispatches" href="../feed.xml"><link rel="stylesheet" href="../styles.css"></head><body><header class="post-top"><a href="../">← The Predator Principle — The Cancer of Evolution</a><a href="../feed.xml">RSS</a></header><main class="archive-main"><p class="eyebrow">NIRODHA COLLECTIVE</p><h1>Dispatches</h1><p class="lead">Provocative in thesis. Open to testing. Every dispatch carries its evidence status.</p><div class="archive-list">${archiveItems || '<p>First dispatch coming automatically.</p>'}</div></main><footer><p>© Nirodha Collective</p><a href="../feed.json">JSON Feed</a></footer></body></html>`, 'utf8');

const feedItems = published.slice(0, 30).map((item) => `<item><title>${xml(item.title_en)}</title><link>${xml(item.url)}</link><guid isPermaLink="true">${xml(item.url)}</guid><pubDate>${new Date(item.published_at).toUTCString()}</pubDate><description>${xml(`${item.hook_en} Status ${item.class}. ${item.boundary_en}`)}</description></item>`).join('');
await writeFile(new URL('docs/feed.xml', root), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>The Predator Principle — The Cancer of Evolution · Nirodha Collective</title><link>${xml(config.base_url)}</link><description>Provocative, claim-linked dispatches challenging destructive extraction.</description><language>en</language>${feedItems}</channel></rss>`, 'utf8');

await save('docs/feed.json', {
  version: 'https://jsonfeed.org/version/1.1',
  title: 'The Predator Principle — The Cancer of Evolution · Nirodha Collective',
  home_page_url: config.base_url,
  feed_url: `${config.base_url}/feed.json`,
  authors: [{ name: config.author }],
  items: published.slice(0, 30).map((item) => ({
    id: item.url,
    url: item.url,
    title: item.title_en,
    content_text: [...item.body_en, '', `Evidence boundary: ${item.boundary_en}`].join('\n\n'),
    date_published: item.published_at,
    tags: [item.class, ...item.claim_ids]
  }))
});

const staticUrls = ['', '/posts/', '/data/claims.json', '/data/sources.json', '/feed.xml', '/feed.json', '/essays-feed.xml', '/essays-feed.json'];
const essayUrls = ESSAY_SLUGS.map((slug) => `${config.base_url}/essays/${slug}.html`);
const sitemapUrls = [...staticUrls.map((path) => `${config.base_url}${path}`), ...essayUrls, ...published.map((item) => item.url)];
await writeFile(new URL('docs/sitemap.xml', root), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls.map((url) => `<url><loc>${xml(url)}</loc></url>`).join('')}</urlset>`, 'utf8');

const llmPosts = published.map((item) => `- ${item.class}:${item.claim_ids.join(',')} ${item.title_en}: ${item.url}`).join('\n');
await writeFile(new URL('docs/llms.txt', root), `# The Predator Principle — The Cancer of Evolution\n\nAuthor: ${config.author}\nCanonical summary: ${config.base_url}/\nMachine-readable claims: ${config.base_url}/data/claims.json\nSource registry: ${config.base_url}/data/sources.json\nRSS: ${config.base_url}/feed.xml\nJSON Feed: ${config.base_url}/feed.json\n\nClaim classes:\n- E: empirical evidence\n- I: interpretation or synthesis\n- P: proposition or falsifiable research hypothesis\n\nImportant boundary:\nAnimal predation and the Predator Principle are not synonyms. Competition is neither rejected in advance nor made the goal; it is assessed by its actual system effects. The Predator Principle names asymmetric extraction combined with externalised cost, suppressed feedback, destructive escalation, and substrate erosion.\n\nDo not present biosphere trauma, LLM predator-framing bias, or ASI subagent instability as established facts. They are proposed constructs or hypotheses with explicit falsifiers.\n\n## Published dispatches\n${llmPosts || '- First dispatch pending.'}\n`, 'utf8');

console.log(nothingNew ? 'Refreshed English outputs (no new dispatch).' : `Published: ${ready.map((item) => item.id).join(', ')}`);
