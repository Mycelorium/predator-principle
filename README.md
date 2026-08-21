# The Predator Principle

Essays and an open claim register, arguing that generalised predation —
a part optimising against the whole that carries it — behaves like a cancer
within evolution.

**Read them here: <https://mycelorium.github.io/predator-principle/>**

## What the claim is, and is not

Predation is real, ancient, and locally adaptive. Some predators stabilise the
systems they live in. None of that is disputed here.

The claim is about a *pattern*, not about animals. A system is predatory in this
sense when extraction runs one way, costs land on someone who cannot answer,
corrective feedback is captured or switched off, escalation becomes compulsory,
and the substrate that carries the whole thing is worn down. A lion does not
meet that description; it is bound by feedback that answers back. A firm
competing on price does not meet it either — competition is not predation, and
conflating the two is exactly where extraction hides.

The full statement, with the mechanism, the four levels of the argument and the
conditions that would falsify it, is at
[foundation.html](https://mycelorium.github.io/predator-principle/foundation.html).

## Take a claim further

The register at
[the front page](https://mycelorium.github.io/predator-principle/#evidence)
lists every claim with its boundary, what would falsify it, and the papers
behind it. `docs/data/claims.json` is the machine-readable version.

- **You have work that bears on a claim** — a paper, a dataset, a model, an
  analysis → open a
  [research submission](https://github.com/Mycelorium/predator-principle/issues/new?template=01-contribute-research.yml).
  C008, C009 and C010 are the least explored.
- **A claim is wrong, overstated, or missing a boundary** → open a
  [claim challenge](https://github.com/Mycelorium/predator-principle/issues/new?template=02-challenge-a-claim.yml).
  Primary evidence is required: a DOI, a dataset, code, or an exact
  counterexample.
- **You would rather just write** → <office@artecont.at>. No account, no form.

Work that narrows a claim is as useful as work that widens it. Both change the
register, and the change is visible in the git history.

## The repository

    docs/        the published site: essays, foundation, observatory, register
    docs/data/   claims, sources, glossary, and the observatory readings, as JSON
    essays/      the essay sources
    corpus/      the underlying position, methodology and evidence map
    scripts/     site build, syndication, archiving, data retrieval
    content/     ledgers written by the workflows; not written by hand

`scripts/build-site.mjs` generates the feeds, the sitemap and `llms.txt` from
`docs/essays-feed.xml`. GitHub Actions rebuild and deploy on every push, refresh
the observatory readings from their published sources, post new essays to the
social channels, and request Wayback snapshots once a week.

To read the site locally:

    python3 -m http.server 8000 --directory docs

## How this is written

The essays are written with AI assistance. The argument, the direction and every
editorial decision are the collective's; drafting, source retrieval and the
checking pass are done with a language model. Every factual statement is traced
to a named source and appears in the register with a DOI wherever one exists.

## Rights

Original public content by Nirodha Collective under
[CC BY 4.0](LICENSE.md). Contact: <office@artecont.at>.
