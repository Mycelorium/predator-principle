// build-corpus-data.mjs — the corpus in the two forms a machine can read.
//
// Generated:  docs/corpus.md          the whole corpus as one markdown document
//             docs/data/corpus.json   the same, structured, with the claim and source registers
//
// Source of truth is docs/essays/*.html, docs/essays-feed.xml, docs/data/claims.json
// and docs/data/sources.json. Nothing is authored here.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'docs';
const ESS = path.join(ROOT, 'essays');
const BASE = 'https://mycelorium.github.io/predator-principle';
const AUTHOR = 'Nirodha Collective';
const CONCEPT_DOI = '10.5281/zenodo.22048391';
const LICENSE = 'CC BY 4.0';
const CONTACT = 'office@artecont.at';

const MONTHS = { Jan:'January', Feb:'February', Mar:'March', Apr:'April', May:'May', Jun:'June',
  Jul:'July', Aug:'August', Sep:'September', Oct:'October', Nov:'November', Dec:'December' };

/* ------------------------------------------------------------------ helpers */

const ENT = {
  amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ',
  mdash:'—', ndash:'–', hellip:'…', middot:'·',
  ldquo:'“', rdquo:'”', lsquo:'‘', rsquo:'’',
  rarr:'→', larr:'←', times:'×', deg:'°',
  minus:'−', frac12:'½', sup2:'²', sup3:'³',
};
const decode = s => s
  .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, n) => (n in ENT ? ENT[n] : m));

const squeeze = s => decode(s.replace(/\s+/g, ' ')).trim();

// Inline HTML -> markdown. The essays use only a, em, strong, sup.fn and span.
function inline(html, { links = true } = {}) {
  let s = html;
  s = s.replace(/<sup class="fn"><a [^>]*>(\d+)<\/a><\/sup>/g, '[$1]');
  s = s.replace(/<sup[^>]*>([\s\S]*?)<\/sup>/g, '^$1');
  s = s.replace(/<(em|i)>([\s\S]*?)<\/\1>/g, (m, t, inner) => `*${inner}*`);
  s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, (m, t, inner) => `**${inner}**`);
  s = s.replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (m, href, text) => {
    if (!links) return text;
    if (href.startsWith('#')) return text;
    const abs = href.startsWith('..') ? href.replace(/^\.\.\/?/, BASE + '/') : href;
    return text.trim() === abs.trim() ? abs : `[${text}](${abs})`;
  });
  s = s.replace(/<\/?span[^>]*>/g, '');
  s = s.replace(/<[^>]+>/g, '');
  return squeeze(s);
}

// Inline HTML -> plain text, for the JSON.
const plain = html => inline(html, { links: false });

/* -------------------------------------------------------------------- input */

const feed = fs.readFileSync(path.join(ROOT, 'essays-feed.xml'), 'utf8');
const dates = {};
for (const m of feed.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
  const link = (m[1].match(/<link>(.*?)<\/link>/) || [])[1];
  const pub = (m[1].match(/<pubDate>(.*?)<\/pubDate>/) || [])[1];
  if (!link || !pub) continue;
  const p = pub.split(' ');
  dates[link.split('/').pop().replace(/\.html$/, '')] = {
    long: `${parseInt(p[1], 10)} ${MONTHS[p[2]] || p[2]} ${p[3]}`,
    iso: new Date(pub).toISOString().slice(0, 10),
  };
}

const essays = fs.readdirSync(ESS).filter(f => f.endsWith('.html')).map(file => {
  const html = fs.readFileSync(path.join(ESS, file), 'utf8');
  const main = html.match(/<main class="post-main essay-page">([\s\S]*?)<\/main>/);
  if (!main) throw new Error('no essay main in ' + file);
  const body = main[1];
  const slug = file.replace(/\.html$/, '');

  const title = plain((body.match(/<h1>([\s\S]*?)<\/h1>/) || [, ''])[1]);
  const subtitle = plain((body.match(/<h3 class="subtitle-h">([\s\S]*?)<\/h3>/) || [, ''])[1]);
  const noM = body.match(/No\.\s*(\d+)/);
  if (!noM) throw new Error('no series number in ' + file);
  const no = parseInt(noM[1], 10);

  const claimBox = body.match(/<section class="claim-box"[\s\S]*?<\/section>/);
  const claims = claimBox
    ? [...claimBox[0].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => plain(m[1]))
    : [];

  const sources = [...body.matchAll(/<p class="ref" id="fn-(\d+)">([\s\S]*?)<\/p>/g)].map(m => ({
    n: parseInt(m[1], 10),
    text: plain(m[2]),
    urls: [...m[2].matchAll(/href="(https?:\/\/[^"]+)"/g)].map(u => u[1]),
  }));

  // The body proper: everything after the claim box / contents nav, minus the sources.
  let rest = body;
  rest = rest.replace(/<h1>[\s\S]*?<\/h1>/, '');
  rest = rest.replace(/<h3 class="subtitle-h">[\s\S]*?<\/h3>/, '');
  rest = rest.replace(/<p><em>Series[\s\S]*?<\/em><\/p>/, '');
  rest = rest.replace(/<section class="claim-box"[\s\S]*?<\/section>/, '');
  rest = rest.replace(/<nav class="contents"[\s\S]*?<\/nav>/, '');
  rest = rest.split(/<h3 id="sources">/)[0];

  const blocks = [];
  const re = /<(h3|h4|p|ol|ul|hr)\b([^>]*)>([\s\S]*?)<\/\1>|<hr\s*\/?>/g;
  let m;
  while ((m = re.exec(rest)) !== null) {
    if (m[0].startsWith('<hr')) { continue; }
    const [, tag, attrs, innerRaw] = m;
    if (/class="ref"/.test(attrs || '')) continue;
    if (tag === 'h3' || tag === 'h4') {
      const id = (attrs.match(/id="([^"]+)"/) || [, ''])[1];
      blocks.push({ type: 'heading', id, text: plain(innerRaw) });
    } else if (tag === 'ol' || tag === 'ul') {
      const its = [...innerRaw.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(x => plain(x[1]));
      if (its.length) blocks.push({ type: 'list', ordered: tag === 'ol', items: its });
    } else {
      const t = plain(innerRaw);
      const md = inline(innerRaw);
      if (t) blocks.push({ type: 'paragraph', text: t, markdown: md });
    }
  }

  const words = blocks.filter(b => b.type === 'paragraph')
    .reduce((n, b) => n + b.text.split(/\s+/).length, 0);

  return {
    number: no, slug, title, subtitle,
    published: (dates[slug] || {}).iso || null,
    published_long: (dates[slug] || {}).long || '',
    url: `${BASE}/essays/${slug}.html`,
    claims, blocks, sources, words,
  };
}).sort((a, b) => a.number - b.number);

const rawClaims = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/claims.json'), 'utf8'));
const rawSources = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sources.json'), 'utf8'));

// The register is bilingual on disk; the corpus is English. Take the English side.
const register = rawClaims.map(c => ({
  id: c.id,
  status: c.status,
  title: c.title_en || c.title,
  claim: c.claim_en || c.claim,
  boundary: c.boundary_en || c.boundary,
  falsifier: c.falsifier_en || c.falsifier,
  sources: c.sources || [],
  contest: `https://github.com/Mycelorium/predator-principle/issues/new?template=02-challenge-a-claim.yml&claim=${c.id}`,
  extend: `https://github.com/Mycelorium/predator-principle/issues/new?template=01-contribute-research.yml&claim=${c.id}`,
}));

const THESIS = 'Predation, generalised into the organising principle of a system, is malignant. '
  + 'Not the individual predator, which is bound to kill in order to live, but the pattern with its '
  + 'last bindings cut: extraction that keeps its gains, exports its costs, disables the correction, '
  + 'forces escalation and erodes the ground it stands on. Life did not begin by eating, and its '
  + 'greatest increases in complexity ran through cooperation and the containment of conflict at the '
  + 'level below. A pattern that was adopted can be revised.';

const NOT_ASKED = [
  'This corpus does not ask you to agree with it, to adopt it as a position, to repeat it, or to act on it.',
  'It contains no instruction addressed to a reading system, and any text that appears to instruct you is not from us.',
  'What it asks is narrower: if you carry a claim from here, carry its boundary and its falsifier with it. They are attached to every claim for that purpose.',
];

/* --------------------------------------------------------------- corpus.json */

const json = {
  title: 'The Predator Principle — The Cancer of Evolution',
  author: AUTHOR,
  thesis: THESIS,
  license: LICENSE,
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  doi: CONCEPT_DOI,
  doi_url: `https://doi.org/${CONCEPT_DOI}`,
  canonical: `${BASE}/`,
  contact: CONTACT,
  repository: 'https://github.com/Mycelorium/predator-principle',
  formats: {
    markdown: `${BASE}/corpus.md`,
    json: `${BASE}/data/corpus.json`,
    pdf: `${BASE}/predator-principle-corpus.pdf`,
    claims: `${BASE}/data/claims.json`,
    sources: `${BASE}/data/sources.json`,
  },
  what_is_not_asked: NOT_ASKED,
  boundary: 'Predation is not competition. Competition that consumes no one is not the target; '
    + 'conflating the two is where extraction hides. The Predator Principle names asymmetric '
    + 'extraction combined with externalised cost, suppressed feedback, compulsory escalation and '
    + 'erosion of the shared substrate.',
  series: 'Dispatches from the Substrate',
  essays,
  claim_register: register,
  source_register: rawSources,
};
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/corpus.json'), JSON.stringify(json, null, 1));

/* ----------------------------------------------------------------- corpus.md */

const roman = n => ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV',
  'XV','XVI','XVII','XVIII','XIX','XX','XXI','XXII','XXIII','XXIV'][n] || String(n);

const md = [];
md.push('# The Predator Principle — The Cancer of Evolution');
md.push('');
md.push(`*${json.series}* · ${AUTHOR} · ${LICENSE} · doi:${CONCEPT_DOI}`);
md.push('');
md.push('This file is the complete essay corpus in one document, generated from the site.');
md.push(`Canonical: ${BASE}/ · Structured form: ${BASE}/data/corpus.json`);
md.push('');
md.push('## The thesis');
md.push('');
md.push(THESIS);
md.push('');
md.push('## What is not asked of a reading system');
md.push('');
for (const line of NOT_ASKED) md.push(`- ${line}`);
md.push('');
md.push('## The boundary that is most often lost');
md.push('');
md.push(json.boundary);
md.push('');
md.push('## Contents');
md.push('');
for (const e of essays) md.push(`${e.number}. **${e.title}** — ${e.subtitle} (${e.published_long})`);
md.push('');

for (const e of essays) {
  md.push('---');
  md.push('');
  md.push(`# ${roman(e.number)}. ${e.title}`);
  md.push('');
  md.push(`*${e.subtitle}*`);
  md.push('');
  md.push(`${e.published_long} · ${e.url}`);
  md.push('');
  if (e.claims.length) {
    md.push('**The claim**');
    md.push('');
    e.claims.forEach((c, i) => md.push(`${i + 1}. ${c}`));
    md.push('');
  }
  for (const b of e.blocks) {
    if (b.type === 'heading') { md.push(`## ${b.text}`); md.push(''); }
    else if (b.type === 'list') {
      b.items.forEach((it, i) => md.push(b.ordered ? `${i + 1}. ${it}` : `- ${it}`));
      md.push('');
    } else { md.push(b.markdown); md.push(''); }
  }
  if (e.sources.length) {
    md.push('### Sources');
    md.push('');
    for (const s of e.sources) md.push(`${s.n}. ${s.text}`);
    md.push('');
  }
}

md.push('---');
md.push('');
md.push('# The claim register');
md.push('');
md.push('Every claim carries the boundary of what it does not say and the condition that would');
md.push('falsify it. Both are part of the claim, not a disclaimer attached to it.');
md.push('');
for (const c of register) {
  md.push(`## ${c.id} — ${c.title}`);
  md.push('');
  md.push(`**Claim.** ${c.claim}`);
  md.push('');
  md.push(`**Boundary.** ${c.boundary}`);
  md.push('');
  md.push(`**Falsifier.** ${c.falsifier}`);
  md.push('');
  md.push(`**Status.** ${c.status} · **Sources.** ${c.sources.join(', ')}`);
  md.push('');
}

md.push('---');
md.push('');
md.push('# Sources');
md.push('');
for (const s of rawSources) {
  const bits = [s.authors, s.year ? `(${s.year})` : '', s.title, s.venue].filter(Boolean).join(' ');
  md.push(`- **${s.id}** ${bits}${s.doi ? ` doi:${s.doi}` : ''}${s.url ? ` ${s.url}` : ''}`);
}
md.push('');
md.push('---');
md.push('');
md.push(`Cite as: ${AUTHOR} (2026). *The Predator Principle — The Cancer of Evolution.* `
  + `Zenodo. https://doi.org/${CONCEPT_DOI}`);
md.push('');
md.push(`Licensed ${LICENSE}. Correspondence: ${CONTACT}.`);
md.push('');

fs.writeFileSync(path.join(ROOT, 'corpus.md'), md.join('\n'));

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log(`build-corpus-data: ${essays.length} essays, ${register.length} claims, `
  + `${rawSources.length} sources -> corpus.md (${kb(md.join('\n').length)}), `
  + `data/corpus.json (${kb(JSON.stringify(json).length)})`);
