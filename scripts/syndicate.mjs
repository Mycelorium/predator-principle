// syndicate.mjs — post new feed items to Bluesky, Mastodon, Telegram and Discord.
//
// Same contract as scripts/nostr-post.mjs: a channel whose secret is missing is
// simply skipped. Nothing here can break a publish run — every network error is
// caught and logged. State lives in content/syndication-state.json so nothing is
// ever posted twice.
//
// Secrets (all optional, add them whenever you like):
//   BSKY_HANDLE + BSKY_APP_PASSWORD      Bluesky (app password, NOT the account password)
//   MASTODON_INSTANCE + MASTODON_TOKEN   Mastodon (token needs write:statuses)
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID  Telegram channel (bot must be admin)
//   DISCORD_WEBHOOK_URL                  Discord channel webhook
//
// First activation of a channel does NOT dump the whole archive: only the newest
// BACKFILL items are posted, the rest are marked as seen.

import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const BACKFILL = Number(process.env.SYNDICATION_BACKFILL || 3);
const PAUSE_MS = 2500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadJSON = async (path, fallback) => {
  try { return JSON.parse(await readFile(new URL(path, root), 'utf8')); }
  catch { return fallback; }
};

const state = await loadJSON('content/syndication-state.json', {});
for (const key of ['bluesky', 'mastodon', 'telegram', 'discord']) state[key] ||= [];

// docs/feed.json is generated from the essay corpus by scripts/build-site.mjs
// and is the single source for syndication. Reading the essays feed as well
// would post every item twice.
const feeds = [
  await loadJSON('docs/feed.json', { items: [] }),
];

const items = feeds
  .flatMap((feed) => feed.items || [])
  .map((item) => ({
    id: item.id || item.url,
    url: item.url,
    title: String(item.title || '').split(' / ')[0].trim(),
    hook: String(item.content_text || '').split('\n').find((line) => line.trim()) || '',
    date: item.date_published || '',
  }))
  .filter((item) => item.url && item.title)
  .sort((a, b) => new Date(a.date) - new Date(b.date)); // oldest first: timeline reads in order

if (!items.length) {
  console.log('No feed items found — nothing to syndicate.');
  process.exit(0);
}

const trim = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

// ---------------------------------------------------------------- Bluesky ----
const bluesky = {
  name: 'bluesky',
  enabled: () => Boolean(process.env.BSKY_HANDLE && process.env.BSKY_APP_PASSWORD),
  session: null,
  async login() {
    const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: process.env.BSKY_HANDLE,
        password: process.env.BSKY_APP_PASSWORD,
      }),
    });
    if (!res.ok) throw new Error(`login HTTP ${res.status}`);
    this.session = await res.json();
  },
  async post(item) {
    if (!this.session) await this.login();
    const text = `${trim(item.title, 120)}\n\n${trim(item.hook, 140)}\n\n${item.url}`;
    const bytes = new TextEncoder().encode(text);
    const marker = new TextEncoder().encode(item.url);
    // byte offsets of the URL, required for a clickable link facet
    let start = -1;
    outer: for (let i = 0; i <= bytes.length - marker.length; i += 1) {
      for (let j = 0; j < marker.length; j += 1) if (bytes[i + j] !== marker[j]) continue outer;
      start = i; break;
    }
    const facets = start >= 0 ? [{
      index: { byteStart: start, byteEnd: start + marker.length },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: item.url }],
    }] : [];
    const res = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: this.session.did,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text,
          facets,
          langs: ['en'],
          createdAt: new Date().toISOString(),
          embed: {
            $type: 'app.bsky.embed.external',
            external: { uri: item.url, title: trim(item.title, 300), description: trim(item.hook, 300) },
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`post HTTP ${res.status} ${trim(await res.text(), 200)}`);
  },
};

// --------------------------------------------------------------- Mastodon ----
const mastodon = {
  name: 'mastodon',
  enabled: () => Boolean(process.env.MASTODON_INSTANCE && process.env.MASTODON_TOKEN),
  async post(item) {
    const base = process.env.MASTODON_INSTANCE.replace(/\/+$/, '').replace(/^(?!https?:)/, 'https://');
    const status = `${trim(item.title, 150)}\n\n${trim(item.hook, 250)}\n\n${item.url}\n\n#predation #evolution #cooperation`;
    const res = await fetch(`${base}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MASTODON_TOKEN}`,
        'Idempotency-Key': item.id,
      },
      body: JSON.stringify({ status, visibility: 'public', language: 'en' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${trim(await res.text(), 200)}`);
  },
};

// --------------------------------------------------------------- Telegram ----
const telegram = {
  name: 'telegram',
  enabled: () => Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  async post(item) {
    const text = `${item.title}\n\n${item.hook}\n\n${item.url}`;
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${trim(await res.text(), 200)}`);
  },
};

// ---------------------------------------------------------------- Discord ----
const discord = {
  name: 'discord',
  enabled: () => Boolean(process.env.DISCORD_WEBHOOK_URL),
  async post(item) {
    const res = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `**${item.title}**\n${item.hook}\n${item.url}` }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${trim(await res.text(), 200)}`);
  },
};

// ------------------------------------------------------------------- run -----
let changed = false;

for (const channel of [bluesky, mastodon, telegram, discord]) {
  if (!channel.enabled()) { console.log(`${channel.name}: no secret set — skipped.`); continue; }

  const seen = new Set(state[channel.name]);
  let pending = items.filter((item) => !seen.has(item.id));

  if (!seen.size && pending.length > BACKFILL) {
    const skipped = pending.slice(0, pending.length - BACKFILL);
    for (const item of skipped) state[channel.name].push(item.id);
    pending = pending.slice(-BACKFILL);
    changed = true;
    console.log(`${channel.name}: first run — archive of ${skipped.length} marked as seen, posting the newest ${pending.length}.`);
  }

  if (!pending.length) { console.log(`${channel.name}: up to date.`); continue; }

  for (const item of pending) {
    try {
      await channel.post(item);
      state[channel.name].push(item.id);
      changed = true;
      console.log(`${channel.name}: posted ${item.url}`);
    } catch (error) {
      console.log(`${channel.name}: FAILED for ${item.url} — ${error.message}`);
      break; // stop this channel, keep order intact, retry on the next run
    }
    await sleep(PAUSE_MS);
  }
}

for (const key of Object.keys(state)) if (Array.isArray(state[key])) state[key] = state[key].slice(-500);

if (changed) {
  await writeFile(new URL('content/syndication-state.json', root), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  console.log('Syndication ledger updated.');
} else {
  console.log('Nothing to do.');
}
