import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

const owner = process.argv[2] || process.env.GITHUB_REPOSITORY_OWNER;
if (!owner || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner)) {
  throw new Error('Provide a valid GitHub owner: node scripts/configure-repository.mjs GITHUB_USERNAME');
}

const root = new URL('../', import.meta.url);
const textExtensions = new Set(['.md', '.json', '.cff', '.html', '.js', '.mjs', '.yml', '.yaml', '.xml', '.txt']);
const skip = new Set(['.git', 'node_modules', 'dist']);
const files = [];

async function walk(url) {
  for (const entry of await readdir(url, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, url);
    if (entry.isDirectory()) await walk(child);
    else if (textExtensions.has(extname(entry.name)) || entry.name === 'CITATION.cff') files.push(child);
  }
}

await walk(root);
let changed = 0;
for (const file of files) {
  const source = await readFile(file, 'utf8');
  if (!source.includes('OWNER')) continue;
  await writeFile(file, source.replaceAll('OWNER', owner), 'utf8');
  changed += 1;
}

console.log(`Configured GitHub owner '${owner}' in ${changed} file(s).`);
