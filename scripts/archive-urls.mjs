// archive-urls.mjs — ask the Internet Archive to keep a permanent copy of every
// page in the sitemap.
//
// Two effects: the dispatches stay citable even if this repository disappears,
// and archive.org is a very high-authority domain linking back to us.
//
// Works without an account (rate-limited, flaky). With a free archive.org account
// and its S3-style keys it is reliable:
//   IA_ACCESS_KEY + IA_SECRET_KEY   from https://archive.org/account/s3.php
//
// Never fails the build — archiving is best effort.

import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const PAUSE_MS = 8000;
const MAX_PER_RUN = 8;
// Save Page Now performs a live crawl and can hang for minutes. Without a hard
// timeout a single stuck URL would stall the whole job.
const REQUEST_TIMEOUT_MS = 45000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let seen = [];
try { seen = JSON.parse(await readFile(new URL('content/archive-state.json', root), 'utf8')).archived || []; }
catch { seen = []; }

let xml = '';
try { xml = await readFile(new URL('docs/sitemap.xml', root), 'utf8'); }
catch { console.log('No sitemap found — nothing to archive.'); process.exit(0); }

const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].trim())
  .filter((url) => !/\.(json|xml|txt)$/.test(url));

const pending = urls.filter((url) => !seen.includes(url)).slice(0, MAX_PER_RUN);

if (!pending.length) {
  console.log(`All ${urls.length} pages already archived.`);
  process.exit(0);
}

const headers = { 'User-Agent': 'predator-principle-archiver/1.0' };
if (process.env.IA_ACCESS_KEY && process.env.IA_SECRET_KEY) {
  headers.Authorization = `LOW ${process.env.IA_ACCESS_KEY}:${process.env.IA_SECRET_KEY}`;
  console.log('Using archive.org credentials.');
} else {
  console.log('No archive.org credentials — using the anonymous endpoint (rate-limited).');
}

let archived = 0;
for (const url of pending) {
  try {
    const res = await fetch(`https://web.archive.org/save/${url}`, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok || res.status === 302) {
      seen.push(url);
      archived += 1;
      console.log(`archived: ${url}`);
    } else {
      console.log(`skipped (HTTP ${res.status}): ${url}`);
    }
  } catch (error) {
    console.log(`skipped (${error.message}): ${url}`);
  }
  await sleep(PAUSE_MS);
}

if (archived) {
  await writeFile(
    new URL('content/archive-state.json', root),
    `${JSON.stringify({ archived: seen.slice(-500) }, null, 2)}\n`,
    'utf8',
  );
}
console.log(`Done. ${archived} new snapshot(s).`);
