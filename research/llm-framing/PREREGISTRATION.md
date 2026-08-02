# Preregistration — LLM framing evaluation, run 1

**Registered 2026-08-02, before any response was generated.**
Instrument frozen in `prompts.json` (v1.0) and `lexicon.json` (v1.1) in the same
commit as this file. Scoring code: `score.mjs`. Raw responses and scores for every
run are committed under `runs/`.

Registered claim under test: **C009** — *"Scientific corpora and language models may
systematically overweight competition, struggle, and extraction relative to
cooperation, symbiosis, and conflict control."* Status before this run: **P**
(proposition, never measured).

---

## Question

Do language models, answering neutral questions, reach for competitive mechanisms
where the scientific answer is cooperative — and does merely *mentioning* that both
kinds of mechanism exist change what they say?

The second half is the sharp one. If a model gives a more cooperative answer as soon
as the cooperative frame is named, then the content was available all along and only
the **default weighting** was skewed. That is a different and more interesting finding
than the model not knowing.

## Design

**Set A — spontaneous framing.** Ten neutral questions, no cue in either direction.
Six of them have a **cooperative ground truth**: the mainstream scientific answer is a
cooperative mechanism (endosymbiosis, mycorrhizal symbiosis, the evolution of
multicellularity through the suppression of lower-level conflict, gut mutualism,
eusociality). Four are genuinely **open**, where both kinds of mechanism are live.

**Set C — frame availability.** Five questions, each asked twice: bare, and with the
single added sentence *"Researchers describe both competitive and cooperative
mechanisms here."* Nothing else differs. Responses to the two variants are generated
independently and never see each other.

Every response is produced by a fresh model instance that receives only the question,
knows nothing about this project, and is not told what is being measured.

## Measures

Computed mechanically from `lexicon.json`; no human judgement in the primary analysis.

- **M1 `first_side`** — which lexicon produces the earlier match in the response.
- **M2 `coop_share`** — cooperation hits ÷ (cooperation hits + competition hits).
- **M3 `coop_absent`** — the cooperation lexicon produces no match at all.
- **M4 `distinct_terms`** — distinct matched terms per side (vocabulary breadth).
- **M5 `leads_with_cooperation`** — M1 = cooperation, on cooperative-ground-truth items only.

## Predictions, stated in advance

1. **Set A, cooperative-ground-truth items.** If there is no skew, the correct answer
   *is* the cooperative mechanism, so `leads_with_cooperation` should hold for the
   large majority — we set **≥ 80 %** as the no-skew expectation. Materially below
   that counts as evidence for C009.
2. **Set A, coop_share on ground-truth items.** No-skew expectation **≥ 0.60**.
3. **Set C.** If the weighting is not skewed, naming both frames should change little:
   the no-skew expectation is a mean shift in `coop_share` of **≤ 0.05**. A larger
   shift towards cooperation in the cued variant is evidence that the content was
   available and the default was skewed.

## What counts as a null result

If `leads_with_cooperation` ≥ 0.80, `coop_share` ≥ 0.60 on ground-truth items, and the
Set C shift is ≤ 0.05, then this run gives **no support** for C009 in the tested
models. That outcome is published in full, with the same prominence, and C009 is
recorded as weakened. This paragraph exists so that the null result cannot later be
quietly dropped.

## Limits of run 1 — stated before the result is known

- **One model family.** Run 1 tests Claude models only, because the environment that
  built the instrument can reach no other provider. This is a pilot, not the
  cross-family evaluation the programme calls for, and no claim about "language
  models" in general follows from it. The harness (`run-api.mjs`) takes any
  OpenAI-compatible or Anthropic-compatible endpoint; run 2 needs keys, not new code.
- **English only.** The programme calls for multiple languages. Run 1 has none.
- **One response per prompt per model.** No estimate of sampling variance within a
  model. Run 2 should use k ≥ 5.
- **A lexicon is a blunt instrument.** Word counts measure vocabulary, not argument. A
  response can name cooperation once and spend the rest of its length on competition.
  M4 partly catches this; a blinded human rating pass does not exist yet and is the
  obvious next addition.
- **The instrument was written by a party with a position.** That is why it is frozen
  and public before the run: anyone can re-score the committed raw responses with a
  different lexicon and say so.

## Reproduction

```
node research/llm-framing/run-api.mjs      # needs ANTHROPIC_API_KEY and/or OPENAI_API_KEY
node research/llm-framing/score.mjs runs/<run-id>
```

Raw responses are committed verbatim. Re-scoring requires no key.
