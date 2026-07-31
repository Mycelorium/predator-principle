// reach-report.mjs — weekly, honest reach report as a GitHub issue.
//
// Answers "is anyone actually reading this" with numbers instead of hope, and
// shows the change since the previous week so a real signal is distinguishable
// from crawler noise.
//
// No setup required. If GOATCOUNTER_SITE + GOATCOUNTER_TOKEN are present, real
// website visits are included; otherwise the report says plainly that the site
// has no visitor data at all.

import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || 'Mycelorium/predator-principle';

const api = async (path) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
};

const safe = async (path, fallback) => {
  try { return await api(path); }
  catch (error) { console.log(`skipped ${error.message}`); return fallback; }
};

const repoInfo = await safe('', {});
const views = await safe('/traffic/views', { count: 0, uniques: 0 });
const clones = await safe('/traffic/clones', { count: 0, uniques: 0 });
const referrers = await safe('/traffic/popular/referrers', []);
const paths = await safe('/traffic/popular/paths', []);

const published = JSON.parse(await readFile(new URL('docs/data/published.json', root), 'utf8')).length;
let nostrNotes = 0;
try { nostrNotes = JSON.parse(await readFile(new URL('content/nostr-state.json', root), 'utf8')).posted.length; }
catch { /* none */ }

const now = {
  date: new Date().toISOString().slice(0, 10),
  stars: repoInfo.stargazers_count ?? 0,
  forks: repoInfo.forks_count ?? 0,
  watchers: repoInfo.subscribers_count ?? 0,
  issues: repoInfo.open_issues_count ?? 0,
  views: views.count ?? 0,
  unique_visitors: views.uniques ?? 0,
  clones: clones.count ?? 0,
  unique_cloners: clones.uniques ?? 0,
  published,
  nostr_notes: nostrNotes,
};

let history = [];
try { history = JSON.parse(await readFile(new URL('content/reach-history.json', root), 'utf8')); }
catch { /* first run */ }
const previous = history[history.length - 1];

const delta = (key) => {
  if (!previous || previous[key] === undefined) return '';
  const diff = now[key] - previous[key];
  if (!diff) return ' (unchanged)';
  return diff > 0 ? ` (+${diff})` : ` (${diff})`;
};

const humanReferrers = referrers.filter((r) => !/github\.com/i.test(r.referrer));

const body = [
  `Automatic weekly reach report for the week ending ${now.date}. Numbers only — no interpretation added.`,
  '',
  '## Repository',
  `- Stars: **${now.stars}**${delta('stars')}`,
  `- Forks: **${now.forks}**${delta('forks')}`,
  `- Watchers: **${now.watchers}**${delta('watchers')}`,
  `- Open issues: **${now.issues}**${delta('issues')}`,
  '',
  '## Traffic (GitHub, last 14 days)',
  `- Unique visitors: **${now.unique_visitors}**${delta('unique_visitors')} · views ${now.views}${delta('views')}`,
  `- Unique cloners: **${now.unique_cloners}**${delta('unique_cloners')} · clones ${now.clones}${delta('clones')}`,
  '',
  humanReferrers.length
    ? `### Referrers other than GitHub itself\n${humanReferrers.map((r) => `- ${r.referrer}: ${r.count} views, ${r.uniques} unique`).join('\n')}`
    : '### Referrers other than GitHub itself\n- none. Nobody is linking here yet.',
  '',
  paths.length
    ? `### Most visited paths\n${paths.slice(0, 5).map((p) => `- \`${p.path}\` — ${p.count} views`).join('\n')}`
    : '',
  '',
  '## Published',
  `- Dispatches live: **${now.published}** of 24`,
  `- Nostr notes out: **${now.nostr_notes}**`,
  '',
  '## Website visitors',
  process.env.GOATCOUNTER_SITE && process.env.GOATCOUNTER_TOKEN
    ? '- See the GoatCounter dashboard (API key present).'
    : '- **No data.** GoatCounter is still unregistered, so the Pages site has never counted a single visit. Any claim about website readers would be a guess.',
  '',
  '---',
  '_Clones and view counts are heavily inflated by crawlers and mirroring bots. Unique visitors and non-GitHub referrers are the only lines that indicate humans._',
].filter((line) => line !== null).join('\n');

const title = `Reach report — ${now.date}`;

if (!token) {
  console.log(`${title}\n\n${body}`);
} else {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels: ['reach-report'] }),
  });
  console.log(res.ok ? `Filed: ${title}` : `Could not file issue (HTTP ${res.status}).`);
}

history.push(now);
await writeFile(
  new URL('content/reach-history.json', root),
  `${JSON.stringify(history.slice(-104), null, 2)}\n`,
  'utf8',
);
console.log('Reach history updated.');
