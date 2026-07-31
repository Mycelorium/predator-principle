// inbox-nostr.mjs — collect replies, reposts and reactions to our Nostr notes and
// file them as a GitHub issue.
//
// Publishing is only half of it. If someone answers while nobody is watching, the
// answer has to come to us. GitHub issues are the one inbox this project already
// has, so everything lands there.
//
// Needs no secret: the npub is public. GITHUB_TOKEN is provided by Actions.

import { readFile, writeFile } from 'node:fs/promises';
import * as nt from 'nostr-tools';
import WebSocket from 'ws';
if (nt.useWebSocketImplementation) nt.useWebSocketImplementation(WebSocket);
else globalThis.WebSocket = WebSocket;

const { SimplePool, nip19 } = nt;

const NPUB = 'npub18z83zhaj6wyxywlx7xyu63777kj77v9cr87tdjt2xmpngltetgtsrw0p5x';
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
  'wss://nostr.wine',
  'wss://relay.snort.social',
];
const KIND = { REPLY: 1, REPOST: 6, REACTION: 7 };
const LOOKBACK_DAYS = 30;

const root = new URL('../', import.meta.url);
const pubkey = nip19.decode(NPUB).data;

let state = { seen: [], last_checked: null };
try { state = { ...state, ...JSON.parse(await readFile(new URL('content/inbox-state.json', root), 'utf8')) }; }
catch { /* first run */ }

const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 3600;
const pool = new SimplePool();

let events = [];
try {
  events = await pool.querySync(RELAYS, {
    kinds: [KIND.REPLY, KIND.REPOST, KIND.REACTION],
    '#p': [pubkey],
    since,
  });
} catch (error) {
  console.log(`Relay query failed (${error.message}) — nothing filed.`);
  process.exit(0);
}

const seen = new Set(state.seen);
const fresh = events
  .filter((event) => event.pubkey !== pubkey)      // ignore our own notes
  .filter((event) => !seen.has(event.id))
  .sort((a, b) => a.created_at - b.created_at);

const label = (kind) => (kind === KIND.REPLY ? 'Reply' : kind === KIND.REPOST ? 'Repost' : 'Reaction');
const short = (text = '') => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 240 ? `${clean.slice(0, 239)}…` : clean;
};

if (!fresh.length) {
  console.log(`No new interactions in the last ${LOOKBACK_DAYS} days (${events.length} events checked).`);
} else {
  const lines = fresh.map((event) => {
    const when = new Date(event.created_at * 1000).toISOString().slice(0, 16).replace('T', ' ');
    const author = nip19.npubEncode(event.pubkey);
    const body = event.kind === KIND.REACTION
      ? `reacted \`${short(event.content) || '+'}\``
      : short(event.content) || '(no text)';
    return `- **${label(event.kind)}** · ${when} UTC\n  ${body}\n  by [\`${author.slice(0, 20)}…\`](https://njump.me/${author}) — [open the note](https://njump.me/${nip19.noteEncode(event.id)})`;
  });

  const title = `Nostr: ${fresh.length} new interaction${fresh.length === 1 ? '' : 's'} — ${new Date().toISOString().slice(0, 10)}`;
  const bodyText = [
    `Someone engaged with the dispatches on Nostr. Collected automatically from ${RELAYS.length} relays.`,
    '',
    ...lines,
    '',
    '---',
    'Replies deserve an answer from the account, not from this issue. Close when handled.',
  ].join('\n');

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log('No GITHUB_TOKEN/GITHUB_REPOSITORY — printing instead of filing:\n');
    console.log(`${title}\n\n${bodyText}`);
  } else {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body: bodyText, labels: ['nostr-inbox'] }),
    });
    console.log(res.ok ? `Filed issue: ${title}` : `Could not file issue (HTTP ${res.status}).`);
  }

  state.seen = [...state.seen, ...fresh.map((event) => event.id)].slice(-1000);
}

state.last_checked = new Date().toISOString();
await writeFile(new URL('content/inbox-state.json', root), `${JSON.stringify(state, null, 2)}\n`, 'utf8');

pool.close(RELAYS);
setTimeout(() => process.exit(0), 1200);
