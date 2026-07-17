// nostr-post.mjs — post new feed items to public Nostr relays (server-side, via
// GitHub Actions). No third-party service, permissionless. Needs the repo secret
// NOSTR_NSEC (an nsec1... or 64-char hex private key). Missing secret => no-op.
//
// State is kept in content/nostr-state.json so nothing is posted twice.
// Author identity: Nirodha Collective.

import { readFile, writeFile } from 'node:fs/promises';
import * as nt from 'nostr-tools';
import WebSocket from 'ws';
if (nt.useWebSocketImplementation) nt.useWebSocketImplementation(WebSocket);
else globalThis.WebSocket = WebSocket;

const { getPublicKey, finalizeEvent, SimplePool, nip19 } = nt;

const SECRET = process.env.NOSTR_NSEC;
if (!SECRET) { console.log('NOSTR_NSEC not set — skipping Nostr syndication.'); process.exit(0); }

// accept nsec1... or hex
let sk;
if (SECRET.startsWith('nsec')) sk = nip19.decode(SECRET).data;
else sk = Uint8Array.from(SECRET.match(/.{1,2}/g).map(h => parseInt(h, 16)));
const pk = getPublicKey(sk);

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
  'wss://nostr.wine',
  'wss://relay.snort.social',
];

async function loadJSON(path, fallback) {
  try { return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')); }
  catch { return fallback; }
}

const root = '../';
const state = await loadJSON(root + 'content/nostr-state.json', { profile: false, posted: [] });
state.posted ||= [];

const feeds = [
  await loadJSON(root + 'docs/feed.json', { items: [] }),
  await loadJSON(root + 'docs/essays-feed.json', { items: [] }),
];
const items = feeds.flatMap(f => f.items || []);
// oldest first, so the timeline reads in order
items.sort((a, b) => new Date(a.date_published) - new Date(b.date_published));

const pool = new SimplePool();
const now = () => Math.floor(Date.now() / 1000);

async function publish(ev) {
  const res = await Promise.allSettled(pool.publish(RELAYS, ev));
  return res.filter(r => r.status === 'fulfilled').length;
}

let posted = 0;

// one-time profile
if (!state.profile) {
  const ev = finalizeEvent({
    kind: 0, created_at: now(), tags: [],
    content: JSON.stringify({
      name: 'Nirodha Collective',
      display_name: 'Nirodha Collective',
      about: 'The Predator Principle — the cancer of evolution. Predation, generalised into the order of everything, is malignant. Cooperation is the older ground. CC BY 4.0.',
      website: 'https://mycelorium.github.io/predator-principle',
    }),
  }, sk);
  const n = await publish(ev);
  if (n > 0) { state.profile = true; console.log(`profile -> ${n} relays`); }
}

for (const item of items) {
  if (state.posted.includes(item.id)) continue;
  const title = (item.title || '').split(' / ')[0].trim();
  const hook = (item.content_text || '').split('\n')[0].trim();
  const text = `${title}\n\n${hook}\n\n${item.url}\n\n#predation #evolution`;
  const ev = finalizeEvent({
    kind: 1, created_at: now(),
    tags: [['t', 'predation'], ['t', 'evolution'], ['r', item.url]],
    content: text,
  }, sk);
  const n = await publish(ev);
  if (n > 0) { state.posted.push(item.id); posted++; console.log(`posted -> ${n} relays: ${item.url}`); }
  await new Promise(r => setTimeout(r, 700));
}

state.posted = state.posted.slice(-300);
await writeFile(new URL(root + 'content/nostr-state.json', import.meta.url), JSON.stringify(state, null, 2) + '\n');
console.log(`Done. ${posted} new note(s). npub: ${nip19.npubEncode(pk)}`);
pool.close(RELAYS);
setTimeout(() => process.exit(0), 1200);
