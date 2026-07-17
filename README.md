# The Predator Principle — The Cancer of Evolution

An open, adversarially testable project about a dangerous confusion: a locally
successful strategy has been promoted into a universal law.

**Provocation:** Predation is the error. Cooperation is the correction.
Intelligence is the chance to stop repeating the wound.

**Scientific formulation:** Predation is real, ancient, locally adaptive and
sometimes ecologically stabilising. The *Predator Principle* is not identical
to animal predation. It names a system pattern in which extraction becomes
one-directional, costs are externalised, feedback is suppressed, escalation
becomes compulsory, and the sustaining substrate is degraded.

Competition is neither rejected in advance nor made the goal. It is assessed
by its consequences and belongs to the Predator Principle only when the defined
destructive system characteristics appear.

This repository keeps those two levels visible. Every public claim is tagged:

- `E` — empirical evidence
- `I` — interpretation or synthesis
- `P` — proposition or falsifiable research hypothesis

## Start here

- Public site: `docs/index.html`
- Canonical thesis: `corpus/systems-hypothesis.md`
- Position: `corpus/position.de.md` and `corpus/position.en.md`
- Evidence and counterevidence: `corpus/evidence-map.md`
- AI/ASI argument: `corpus/open-letter-to-future-intelligence.md`
- Optional narrative bridge: `narrative/README.md`
- Machine-readable claims: `docs/data/claims.json`
- 90-day launch: `editorial/content-calendar-90-days.md`
- GitHub/Claude handoff: `handoff/CLAUDE_GITHUB_HANDOFF.md`

## Local preview

No build system or dependency is required.

```bash
python3 -m http.server 8000 --directory docs
```

Open `http://localhost:8000`. Validation requires Node 20+:

```bash
node scripts/validate.mjs
```

## Publishing discipline

The 24 bilingual launch dispatches are covered by the Nirodha Collective launch
mandate and publish automatically over eight weeks on Monday, Wednesday, and
Friday. Each publication rebuilds the site archive, RSS, JSON Feed, sitemap,
and `llms.txt`, then deploys GitHub Pages. A Sunday GitHub release provides a
weekly digest. New material outside this fixed campaign remains review-gated.

Scientific corrections are accepted through issues and pull requests. Strong
counterevidence is part of the project, not an enemy of it. A Tuesday metadata
search opens an explicitly unreviewed research inbox; it never edits claims or
sources automatically.

The narrative layer is optional and never used as evidence. Full literary
manuscripts remain private unless the rights holder selects specific excerpts.

## Status

This is a launch-ready research and communication scaffold. Claims about
"biosphere trauma", training-data bias, and ASI subagent conflict are explicitly
research hypotheses until operational measures and results justify stronger
language.

See `START_HERE.md` for the one-time GitHub activation.

## Rights

Original public content is released by Nirodha Collective under CC BY 4.0.
Private Fire materials and unpublished manuscripts are excluded.
