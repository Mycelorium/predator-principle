// indexnow.mjs — announce every sitemap URL to the IndexNow network
// (Bing, Yandex, Seznam, Naver share one endpoint). Permissionless: no account,
// no third-party service. The only credential is a self-chosen key that is
// published as a plain text file on the site itself.
//
// Runs server-side from GitHub Actions after every publish, so new dispatches
// and essays are announced the moment they go live instead of waiting for a
// crawler to come by. Failures never break the build — reach is best effort.

import { readFile } from 'node:fs/promises';

const KEY = '803c9ad52c16827b016c3c29fb5efdd4';
const HOST = 'mycelorium.github.io';
const BASE = `https://${HOST}/predator-principle`;
const KEY_LOCATION = `${BASE}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const xml = await readFile(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');

const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].trim())
  .map((u) => u.replace(/^https:\/\/[Mm]ycelorium\.github\.io/, `https://${HOST}`))
  .filter((u) => u.startsWith(BASE))
  .filter((u) => !/\.(json|xml)$/.test(u));

if (!urlList.length) {
  console.log('No page URLs found in docs/sitemap.xml — nothing submitted.');
  process.exit(0);
}

const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };

try {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  console.log(`IndexNow: announced ${urlList.length} URLs -> HTTP ${res.status}`);
  if (res.status >= 400) console.log((await res.text()).slice(0, 500));
} catch (error) {
  console.log(`IndexNow: submission failed (${error.message}) — ignored.`);
}
