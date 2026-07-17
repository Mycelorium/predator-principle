import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const webhook = process.env.SYNDICATION_WEBHOOK_URL;
if (!webhook) {
  console.log('No syndication webhook configured.');
  process.exit(0);
}

const posts = JSON.parse(await readFile(new URL('dist/published-this-run.json', root), 'utf8'));
for (const post of posts) {
  const response = await fetch(webhook, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.SYNDICATION_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.SYNDICATION_WEBHOOK_TOKEN}` } : {})
    },
    body: JSON.stringify({ event: 'predator_principle.dispatch.published', author: 'Nirodha Collective', post })
  });
  if (!response.ok) throw new Error(`Syndication webhook failed with HTTP ${response.status}.`);
}
console.log(`Syndicated ${posts.length} post(s) through the configured webhook.`);
