# Automation architecture

## Safety rule

Automation publishes the 24 items covered by the explicit Nirodha Collective
launch mandate. It never upgrades evidence classes or promotes newly discovered
research on its own. Credentialed social networks require an optional webhook.

## Included workflows

| Workflow | Trigger | Action | External effect |
|---|---|---|---|
| `validate.yml` | push / PR | validates claim and source registries | none |
| `pages.yml` | merge to `main` | deploys `docs/` to GitHub Pages | website update |
| `campaign-autopilot.yml` | initial push + M/W/F schedule | publishes next authorised bilingual dispatch; rebuilds archive, RSS, JSON Feed, sitemap and `llms.txt`; deploys Pages | public website/feed update |
| `weekly-digest-release.yml` | Sunday schedule / manual | creates a digest of that week's dispatches | public GitHub release |
| `research-watch.yml` | Tuesday schedule / manual | searches recent Crossref metadata and opens an explicitly unreviewed candidate inbox | GitHub issue only |
| `weekly-review.yml` | Monday schedule / manual | opens one review issue | GitHub issue |
| `content-drafts.yml` | manual | converts approved queue items to artifacts | downloadable drafts only |

## Future channel adapters

The public website, RSS, JSON Feed, sitemap, `llms.txt`, GitHub release digest,
and research inbox need no external account or API key after GitHub is active.

For broader syndication, one generic adapter is already included. Add an n8n,
Make, Zapier, Buffer, or custom webhook URL as `SYNDICATION_WEBHOOK_URL` and an
optional bearer token as `SYNDICATION_WEBHOOK_TOKEN`. Every newly published
dispatch is then emitted as structured JSON. Channel-specific credentials stay
outside this repository.

Recommended flow:

`pre-authorised campaign → M/W/F scheduler → validation → publish → commit → Pages + feeds`

For new, non-campaign research:

`metadata search → unreviewed issue → primary-paper reading → pull request → validation`

## Failure behaviour

- Invalid claim/source IDs stop publication.
- An empirical (`E`) campaign item without a source stops publication.
- An approved campaign item without the launch mandate stops publication.
- Failure of an optional webhook fails that workflow run but does not erase the
  already committed canonical dispatch.
- When all 24 items are published, the scheduler exits cleanly without repeating
  content.
