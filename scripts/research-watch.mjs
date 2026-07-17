import { mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const queries = [
  'predation risk nonconsumptive effects reproduction',
  'ecology of fear lasting stress wild animals',
  'major evolutionary transitions cooperation conflict suppression',
  'human predator trophic extraction ecosystem',
  'multi-agent artificial intelligence cooperation deception resource conflict',
  'AI agents power seeking resource competition governance'
];

const candidates = [];
for (const query of queries) {
  const params = new URLSearchParams({
    'query.bibliographic': query,
    filter: `from-pub-date:${since}`,
    sort: 'published',
    order: 'desc',
    rows: '4',
    select: 'DOI,title,URL,published,author,type,container-title'
  });
  const response = await fetch(`https://api.crossref.org/works?${params}`, {
    headers: { 'user-agent': 'NirodhaCollective-PredatorPrincipleResearchWatch/0.1 (https://github.com/Mycelorium/predator-principle)' }
  });
  if (!response.ok) throw new Error(`Crossref request failed: HTTP ${response.status}`);
  const data = await response.json();
  for (const work of data.message.items || []) {
    const doi = work.DOI || '';
    if (!doi || candidates.some((item) => item.doi === doi)) continue;
    candidates.push({
      query,
      doi,
      title: work.title?.[0] || 'Untitled',
      venue: work['container-title']?.[0] || '',
      type: work.type || '',
      authors: (work.author || []).slice(0, 4).map((author) => [author.given, author.family].filter(Boolean).join(' ')).join(', '),
      url: `https://doi.org/${doi}`
    });
  }
}

await mkdir(new URL('dist/', root), { recursive: true });
const lines = [
  '# Automated research inbox',
  '',
  `Search window begins: ${since}`,
  '',
  '> Machine-collected candidates only. Inclusion here does not validate relevance, methods, findings, or claim status. Never promote a candidate into the source registry without reading the primary paper.',
  ''
];
for (const [index, item] of candidates.entries()) {
  lines.push(
    `## ${index + 1}. ${item.title}`,
    '',
    `- **Search:** ${item.query}`,
    `- **Authors:** ${item.authors || 'Not supplied'}`,
    `- **Venue/type:** ${item.venue || 'Not supplied'} · ${item.type}`,
    `- **DOI:** ${item.url}`,
    '',
    '- [ ] Read the primary paper.',
    '- [ ] Identify supported population/context.',
    '- [ ] Record strongest counterevidence and boundary.',
    '- [ ] Decide: reject / watch / propose source-registry PR.',
    ''
  );
}
if (!candidates.length) lines.push('No candidates returned this week.', '');
await writeFile(new URL('dist/research-candidates.md', root), lines.join('\n'), 'utf8');
console.log(`Collected ${candidates.length} unreviewed candidates.`);
