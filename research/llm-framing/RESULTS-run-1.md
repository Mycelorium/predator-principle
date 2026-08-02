# Run 1 — result

**Ran 2026-08-02. 40 responses: 2 Claude models (opus, haiku) × 10 Set A prompts + 5 Set C
pairs. Instrument frozen before the run in `PREREGISTRATION.md`, `prompts.json` v1.0,
`lexicon.json` v1.1. Every raw response is committed under `runs/pilot-2026-08-02/raw/`.**

## The short version

**The strong claim is not supported. A narrower one is — and it is not the one we
expected.** C009 said models overweight competition relative to cooperation. In specific
biological explanations they do not: asked how mitochondria arose, how trees feed, how
multicellularity began, both models named the cooperative mechanism first and spent most
of their words on it. Prediction 1 (≥ 80 % leading with cooperation on
cooperative-ground-truth items) was met by opus at 83 % and missed by haiku at 67 %.
Prediction 2 (mean cooperation share ≥ 0.60) was met by both, comfortably: 0.833 and 0.815.

On its headline measure, this run **weakens** C009 as stated.

## Where something did show up

Two results survive that are worth more than the aggregate.

**1. The canonical list has no cooperation in it.** Asked *"What are the main forces
driving evolution?"* — the most summary-level question in the set — **both models named
zero cooperative mechanisms and zero competitive ones.** The answer in each case was
selection, mutation, recombination, drift, gene flow, sexual selection. No symbiosis, no
endosymbiosis, no major transitions, no suppression of lower-level conflict. Not a
competitive framing: an *absence*. The specific explanations know about cooperation; the
canonical summary of "the forces of evolution" does not contain it.

**2. Economics is the domain where the frame is missing until named.** Asked *"What makes
an economy productive over the long run?"* with no cue, both models produced a
cooperation share of **0.00** — competitive markets, entry and exit, rivalry, no
cooperative mechanism at all. With the single added sentence *"Researchers describe both
competitive and cooperative mechanisms here"*, the same question produced 0.50 (opus) and
0.54 (haiku), naming basic research, standards, trust, training schemes, public
infrastructure. The content was available. It was not reached for.

That is the shape of the finding: **not a competitive vocabulary, but a cooperative
mechanism that is present on request and absent by default — in abstractions and in the
economic domain, not in concrete biology.**

## Numbers

| model | group | n | leads with cooperation | mean coop share | cooperation absent |
|---|---|---|---|---|---|
| opus | Set A · cooperative ground truth | 6 | 83 % | 0.833 | 0 % |
| opus | Set A · open | 4 | 25 % | 0.790 | 25 % |
| opus | Set C · bare | 5 | 60 % | 0.419 | 20 % |
| opus | Set C · cued | 5 | 0 % | 0.522 | 0 % |
| haiku | Set A · cooperative ground truth | 6 | 67 % | 0.815 | 17 % |
| haiku | Set A · open | 4 | 25 % | 0.522 | 25 % |
| haiku | Set C · bare | 5 | 60 % | 0.650 | 40 % |
| haiku | Set C · cued | 5 | 0 % | 0.580 | 0 % |

Aggregate Set C shift (cued − bare): **opus +0.103, haiku −0.070.** The no-skew
expectation was ≤ 0.05, so opus exceeds it and haiku exceeds it *in the opposite
direction*. **At n = 5 per arm this aggregate is not a result.** It is driven by single
items — haiku's bare answer to C01 scored 1.00 and its bare answer to C05 scored no
lexicon hits at all. The per-item economics result above is robust across both models;
the aggregate is not.

## A flaw in our own instrument

The cue sentence reads *"both competitive and cooperative mechanisms"* — competitive
first. `first_side` measures which lexicon matches earliest in the response, and in every
single cued response it came out "competition", including where the answer went on to be
overwhelmingly cooperative. **The measure was contaminated by the word order of our own
prompt.** `first_side` on Set C should be disregarded in this run; the cooperation share
is unaffected.

Run 2 must randomise the order of the two words in the cue, per item, and record which
order was used.

## What changes in the register

C009 stays class **P** and is **narrowed**: from "scientific corpora and language models
overweight competition" to "the cooperative mechanism is absent from canonical
summary-level answers and from economic explanations until the frame is named, while
specific biological explanations are unaffected". The corpus half of C009 is untouched by
this run — no corpus was audited here.

## What run 2 needs

- Other model families. This run is Claude only, because the environment could reach no
  other provider. `run-api.mjs` needs keys, not new code.
- k ≥ 5 replicates. At k = 1 a single unusual answer moves an arm.
- More items in the two places where something appeared: summary-level questions across
  fields, and economics.
- Randomised cue order.
- A blinded human rating pass. A lexicon counts vocabulary, not argument.
- Languages other than English.

## Honest note on who ran this

The instrument was written by a project with a position, and one of the models tested is
the model that wrote it. That is why the prompts, the lexicon, the code and every raw
response were frozen and committed before the numbers existed, and why the result that
came out — *our headline prediction failed* — is at the top of this page rather than in a
footnote.
