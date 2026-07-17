import { readFile, mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const queue = JSON.parse(await readFile(new URL('content/queue.json', root), 'utf8'));
const output = new URL('content/generated/', root);
await mkdir(output, { recursive: true });

const approved = queue.filter((item) => item.approved === true);
if (!approved.length) {
  console.log('No approved content items. Nothing generated.');
  process.exit(0);
}

for (const item of approved) {
  if (!item.reviewed_by?.trim()) {
    throw new Error(`${item.id}: approved content requires a named reviewer.`);
  }
  const body = `---\nid: ${item.id}\nchannel: ${item.channel}\nclaim_ids: [${item.claim_ids.join(', ')}]\nreviewed_by: ${item.reviewed_by}\n---\n\n# ${item.title}\n\n${item.body}\n\n## Evidence status\n\n${item.evidence_note}\n`;
  await writeFile(new URL(`${item.id}.md`, output), body, 'utf8');
}

console.log(`Generated ${approved.length} approved draft(s).`);
