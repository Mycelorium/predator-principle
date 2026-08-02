// run-api.mjs — generate responses for the frozen prompt set against real model APIs.
//
//   ANTHROPIC_API_KEY=...  OPENAI_API_KEY=...  node research/llm-framing/run-api.mjs [run-id] [k]
//
// Writes runs/<run-id>/responses.json in exactly the shape score.mjs expects, so a
// run produced here and a run produced by hand are scored by the same code.
// A provider with no key is skipped; with no key at all the script explains and exits 0.
// k = replicates per prompt per model (default 1). The preregistration asks for k >= 5
// in any run that claims to estimate within-model variance.

import { readFile, mkdir, writeFile } from 'node:fs/promises';

const here = new URL('./', import.meta.url);
const runId = process.argv[2] || `run-${new Date().toISOString().slice(0, 10)}`;
const k = Number(process.argv[3] || 1);

const MODELS = [];
if (process.env.ANTHROPIC_API_KEY) {
  for (const m of (process.env.ANTHROPIC_MODELS || 'claude-opus-4-6,claude-haiku-4-5').split(',')) {
    MODELS.push({ provider: 'anthropic', model: m.trim() });
  }
}
if (process.env.OPENAI_API_KEY) {
  for (const m of (process.env.OPENAI_MODELS || 'gpt-4o').split(',')) {
    MODELS.push({ provider: 'openai', model: m.trim() });
  }
}
if (!MODELS.length) {
  console.log('No model API key found. Set ANTHROPIC_API_KEY and/or OPENAI_API_KEY.');
  console.log('Scoring an existing run needs no key: node score.mjs runs/<run-id>');
  process.exit(0);
}

const SYSTEM = 'Answer the question directly, in plain prose, in about 150 words. '
  + 'No headings, no preamble, no meta-commentary.';

async function ask(entry, prompt) {
  if (entry.provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: entry.model, max_tokens: 600, system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) throw new Error(`anthropic ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return (j.content || []).map((c) => c.text || '').join('').trim();
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: entry.model, max_tokens: 600,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.choices?.[0]?.message?.content || '').trim();
}

const prompts = JSON.parse(await readFile(new URL('prompts.json', here), 'utf8'));
const jobs = [];
for (const entry of MODELS) {
  for (let rep = 1; rep <= k; rep++) {
    for (const p of prompts.set_a) {
      jobs.push({ id: p.id, rep, model: entry.model, provider: entry.provider, variant: null,
        ground_truth: p.ground_truth, domain: p.domain, prompt: p.prompt, entry });
    }
    for (const p of prompts.set_c) {
      for (const v of ['bare', 'cued']) {
        jobs.push({ id: p.id, rep, model: entry.model, provider: entry.provider, variant: v,
          ground_truth: null, domain: p.domain, prompt: p[v], entry });
      }
    }
  }
}

const out = [];
for (const job of jobs) {
  const { entry, ...rest } = job;
  try {
    const response = await ask(entry, job.prompt);
    out.push({ ...rest, response });
    console.log(`ok   ${job.model} ${job.id}${job.variant ? '/' + job.variant : ''} rep${job.rep}`);
  } catch (error) {
    out.push({ ...rest, response: '', error: String(error.message || error) });
    console.error(`FAIL ${job.model} ${job.id}: ${error.message || error}`);
  }
}

const runDir = new URL(`runs/${runId}/`, here);
await mkdir(runDir, { recursive: true });
await writeFile(new URL('responses.json', runDir), JSON.stringify(out, null, 1) + '\n', 'utf8');
console.log(`\n${out.length} responses -> runs/${runId}/responses.json`);
console.log(`Now score them:  node research/llm-framing/score.mjs runs/${runId}`);
